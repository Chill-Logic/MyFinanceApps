import { useMemo, useRef, useState } from 'react';
import {
	Alert,
	Animated,
	Modal,
	PanResponder,
	RefreshControl,
	SectionList,
	StyleSheet,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from 'react-native';
import { Toast } from 'react-native-toast-message/lib/src/Toast';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useDeleteTransactions } from '../../../hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '../../../hooks/api/transactions/useListTransactions';

import { useNewTransactionDialog } from '../../../context/newTransactionDialog';
import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
import { MoneyUtils } from '../../../utils/money';
import { TextUtils } from '../../../utils/text';

import { TTransaction } from '../../../types/models';

import MonthYearSelector from '../../atoms/MonthYearSelector';
import Skeleton from '../../atoms/Skeleton';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import { QUERY_KEYS } from '../../../constants/QueryKeys';
import { TransactionFormModal } from '../TransactionFormModal';

const MONTHS_LOWER = [
	'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
	'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

type TTransactionGroup = {
	title: string;
	data: TTransaction[];
};

const isSameDay = (a: Date, b: Date) => (
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
);

const getGroupLabel = (date: Date) => {
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	if (isSameDay(date, today)) return 'Hoje';
	if (isSameDay(date, yesterday)) return 'Ontem';
	return `${ date.getDate() } de ${ MONTHS_LOWER[date.getMonth()] }`;
};

const groupTransactionsByDay = (transactions: TTransaction[]): TTransactionGroup[] => {
	const groups = new Map<string, TTransactionGroup>();

	transactions.forEach((transaction_item) => {
		const date = new Date(transaction_item.transaction_date);
		const key = `${ date.getFullYear() }-${ date.getMonth() }-${ date.getDate() }`;

		if (!groups.has(key)) {
			groups.set(key, { title: getGroupLabel(date), data: [] });
		}
		groups.get(key)!.data.push(transaction_item);
	});

	return Array.from(groups.values());
};

/**
 * Fora do componente de propósito — como prop de componente (ItemSeparatorComponent/
 * SectionSeparatorComponent), uma arrow function definida dentro do render vira uma
 * referência nova a cada renderização, o que o react-hooks/exhaustive-deps acusa
 * (react/no-unstable-nested-components) e pode gerar remount desnecessário dos separadores.
 */
const ItemSeparator = () => <ThemedView style={styles.transactionSeparator} />;
const SectionSeparator = () => <ThemedView style={styles.sectionSeparator} />;

const TransactionsList = () => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const { user_wallet } = useWallet();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const [ month_year_selector_values, setMonthYearSelectorValues ] = useState({
		month: new Date().getMonth(),
		year: new Date().getFullYear(),
	});

	const { start_date, end_date } = DateUtils.getMonthRange(month_year_selector_values.year, month_year_selector_values.month);

	const { data: data_transactions, isLoading: is_data_transactions_loading } = useListTransactions({
		params: {
			wallet_id: user_wallet.data?.id || '',
			start_date: start_date,
			end_date: end_date,
		},
	});

	const [ transaction, setTransaction ] = useState<TTransaction | null>(null);
	const [ actions_transaction, setActionsTransaction ] = useState<TTransaction | null>(null);

	const { refreshControlProps } = useRefresh({
		keys: [
			QUERY_KEYS.transaction.get_all,
		],
	});

	const { mutate: deleteTransaction } = useDeleteTransactions();

	const { width: screen_width } = useWindowDimensions();
	const translate_x = useRef(new Animated.Value(0)).current;

	/*
	 * Forma funcional do setState de propósito — `changeMonth` é chamado de dentro do
	 * `pan_responder` (criado uma única vez via `useRef`, ver abaixo), cujos callbacks ficam
	 * "congelados" com as closures do primeiro render. Lendo `month_year_selector_values`
	 * direto (como uma variável comum) sempre pegaria o valor de quando o gesto foi montado
	 * (ex: sempre "julho"), nunca o mês atual — daí o bug de ficar preso alternando entre só
	 * dois meses ao arrastar repetidas vezes. `prev` aqui sempre reflete o estado mais recente
	 * de verdade, não importa de qual render essa função foi chamada.
	 */
	const changeMonth = (offset: number) => {
		setMonthYearSelectorValues((prev) => {
			const date = new Date(prev.year, prev.month + offset, 1);
			return { month: date.getMonth(), year: date.getFullYear() };
		});
	};

	/*
	 * Desliza o conteúdo atual pra fora (na mesma direção do dedo) e, quando some da tela,
	 * troca o mês e reposiciona o conteúdo novo do lado oposto, animando de volta ao centro —
	 * efeito de "página" entrando, não só o mês trocando seco. `useNativeDriver: false` em
	 * tudo que mexe em `translate_x`, mesmo aqui (podia ser `true`): a RN não deixa misturar
	 * driver nativo com driver JS no mesmo Animated.Value, e o arrasto em si
	 * (`onPanResponderMove`) precisa ser JS-driven pra poder ler `gestureState.dx`.
	 */
	const animateMonthChange = (offset: number, exits_to_right: boolean) => {
		const exit_value = exits_to_right ? screen_width : -screen_width;

		Animated.timing(translate_x, {
			toValue: exit_value,
			duration: 180,
			useNativeDriver: false,
		}).start(() => {
			changeMonth(offset);
			translate_x.setValue(-exit_value);
			Animated.timing(translate_x, {
				toValue: 0,
				duration: 220,
				useNativeDriver: false,
			}).start();
		});
	};

	/*
	 * Mesmo gesto do "clicar na setinha", só que arrastando a lista — igual o comportamento
	 * de trocar de mês deslizando que apps de finanças costumam ter. `onMoveShouldSetPanResponder`
	 * só assume o gesto quando o arrasto é claramente mais horizontal que vertical (2x), pra não
	 * competir com o scroll vertical da SectionList por baixo.
	 */
	const pan_responder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponder: (_, gesture) => (
				Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2
			),
			onPanResponderMove: Animated.event(
				[ null, { dx: translate_x } ],
				{ useNativeDriver: false },
			),
			onPanResponderRelease: (_, gesture) => {
				if (gesture.dx > 60) {
					// arrastou pra direita -> mês anterior, conteúdo sai pela direita
					animateMonthChange(-1, true);
				} else if (gesture.dx < -60) {
					// arrastou pra esquerda -> próximo mês, conteúdo sai pela esquerda
					animateMonthChange(1, false);
				} else {
					Animated.timing(translate_x, { toValue: 0, duration: 150, useNativeDriver: false }).start();
				}
			},
			onPanResponderTerminate: () => {
				Animated.timing(translate_x, { toValue: 0, duration: 150, useNativeDriver: false }).start();
			},
		}),
	).current;

	const transactions = useMemo(() => data_transactions?.data || [], [ data_transactions ]);
	const groups = useMemo(() => groupTransactionsByDay(transactions), [ transactions ]);
	const total = Number(data_transactions?.total ?? 0);
	const total_deposit = transactions.filter((item) => item.kind === 'deposit').reduce((acc, item) => acc + item.value, 0);
	const total_withdraw = transactions.filter((item) => item.kind === 'withdraw').reduce((acc, item) => acc + item.value, 0);

	const isFormOpen = is_new_transaction_open || Boolean(transaction);

	const handleCloseForm = () => {
		setIsNewTransactionOpen(false);
		setTransaction(null);
	};

	const handleDeleteTransaction = (transaction_to_delete: TTransaction) => {
		setTimeout(() => {
			Alert.alert(
				'Excluir Transação',
				`Deseja excluir "${ transaction_to_delete.description }"? Essa ação não pode ser desfeita.`,
				[
					{
						text: 'Cancelar',
						style: 'cancel',
					},
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => {
							deleteTransaction({
								id: transaction_to_delete.id,
								onSuccess: () => {
									Toast.show({
										type: 'success',
										text1: 'Transação excluída com sucesso',
										text2: `A transação ${ transaction_to_delete.description } foi excluída com sucesso`,
									});
								},
								onError: (error) => {
									Toast.show({
										type: 'error',
										text1: 'Erro ao excluir transação',
										text2: getApiErrorMessage(error, `Não foi possível excluir a transação ${ transaction_to_delete.description }`),
									});
								},
							});
						},
					},
				],
			);
		}, 100);
	};

	const getTransactionColor = (type: string) => (
		type === 'deposit' ? styles.textGreen : styles.textRed
	);

	const renderKindIcon = (transaction_item: TTransaction) => {
		const is_deposit = transaction_item.kind === 'deposit';

		return (
			<View
				style={[
					styles.kindIcon,
					{ backgroundColor: is_deposit ? colors['feedback-success-light'] : colors['feedback-danger-light'] },
				]}
			>
				<Icon
					name={is_deposit ? 'arrow-upward' : 'arrow-downward'}
					size={16}
					color={is_deposit ? colors['feedback-success-dark'] : colors['feedback-danger-dark']}
				/>
			</View>
		);
	};

	const renderTransactionItem = ({ item: transaction_item }: { item: TTransaction }) => (
		<TouchableOpacity
			style={[ styles.transactionItem, { backgroundColor: card_surface } ]}
			onPress={() => setTransaction(transaction_item)}
		>
			{renderKindIcon(transaction_item)}

			<ThemedView style={[ styles.transactionLeft, { backgroundColor: 'transparent' } ]}>
				<ThemedText style={styles.transactionDescription}>{TextUtils.truncate({ text: transaction_item.description, maxLength: 35 })}</ThemedText>
				{transaction_item.user_name && <ThemedText style={[ styles.transactionUserName, { color: theme.colors.placeholder } ]}>{transaction_item.user_name}</ThemedText>}
			</ThemedView>

			<ThemedText
				style={[
					styles.transactionValue,
					getTransactionColor(transaction_item.kind),
				]}
			>
				{MoneyUtils.formatMoney(transaction_item.value)}
			</ThemedText>

			<TouchableOpacity
				style={styles.actionsButton}
				onPress={(event) => {
					event.stopPropagation();
					setActionsTransaction(transaction_item);
				}}
				hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
			>
				<Icon name='more-vert' size={20} color={theme.colors.placeholder} />
			</TouchableOpacity>
		</TouchableOpacity>
	);

	const renderSectionHeader = ({ section }: { section: TTransactionGroup }) => (
		<ThemedText style={styles.sectionHeader}>{section.title}</ThemedText>
	);

	return (
		<ThemedView style={styles.transactionsContainer}>
			<ThemedView style={styles.header}>
				<MonthYearSelector
					onChange={(month: number, year: number) => {
						setMonthYearSelectorValues({
							month,
							year,
						});
					}}
					value={{
						month: month_year_selector_values.month,
						year: month_year_selector_values.year,
					}}
				/>

				<ThemedView style={[ styles.balanceContainer, { borderColor: theme.colors.border } ]}>
					<ThemedView style={styles.balanceContainerTransparent}>
						<ThemedText style={styles.balanceLabel}>Saldo</ThemedText>
						{is_data_transactions_loading ? <Skeleton height={20} width={80} /> : (
							<ThemedText style={[ styles.balanceValue, total >= 0 ? styles.textGreen : styles.textRed ]}>
								{MoneyUtils.formatMoney(total)}
							</ThemedText>
						)}
					</ThemedView>

					<ThemedView style={styles.balanceGroup}>
						<ThemedView style={styles.balanceContainerTransparent}>
							<ThemedText style={styles.balanceLabelSmall}>Entrada</ThemedText>
							{is_data_transactions_loading ? <Skeleton height={16} width={64} /> : (
								<ThemedText style={styles.textGreen}>{MoneyUtils.formatMoney(total_deposit)}</ThemedText>
							)}
						</ThemedView>

						<ThemedView style={styles.balanceContainerTransparent}>
							<ThemedText style={styles.balanceLabelSmall}>Saída</ThemedText>
							{is_data_transactions_loading ? <Skeleton height={16} width={64} /> : (
								<ThemedText style={styles.textRed}>{MoneyUtils.formatMoney(total_withdraw)}</ThemedText>
							)}
						</ThemedView>
					</ThemedView>
				</ThemedView>
			</ThemedView>

			<ThemedView style={styles.listContainer} {...pan_responder.panHandlers}>
				<Animated.View style={[ styles.listAnimatedContent, { transform: [ { translateX: translate_x } ] } ]}>
					{is_data_transactions_loading && (
						<ThemedView style={styles.skeletonList}>
							{new Array(6).fill(null).map((_, index) => (
								<Skeleton key={index} height={56} />
							))}
						</ThemedView>
					)}

					{!is_data_transactions_loading && groups.length === 0 && (
						<ThemedView style={styles.emptyContainer}>
							<Icon name='receipt-long' size={40} color={theme.colors.placeholder} />
							<ThemedText style={styles.emptyMessage}>
								Nenhuma transação neste mês
							</ThemedText>
							<ThemedText style={styles.emptySubMessage}>
								Registre uma entrada ou saída pra começar
							</ThemedText>
							<TouchableOpacity
								style={styles.emptyButton}
								disabled={!user_wallet.data?.id}
								onPress={() => {
									setTransaction(null);
									setIsNewTransactionOpen(true);
								}}
							>
								<Icon name='add' size={18} color='white' />
								<ThemedText style={styles.emptyButtonText}>Adicionar transação</ThemedText>
							</TouchableOpacity>
						</ThemedView>
					)}

					{!is_data_transactions_loading && groups.length > 0 && (
						<SectionList
							sections={groups}
							renderItem={renderTransactionItem}
							renderSectionHeader={renderSectionHeader}
							keyExtractor={(item) => item.id}
							style={styles.transactionsList}
							refreshControl={<RefreshControl {...refreshControlProps} />}
							showsVerticalScrollIndicator={false}
							stickySectionHeadersEnabled={false}
							ItemSeparatorComponent={ItemSeparator}
							SectionSeparatorComponent={SectionSeparator}
						/>
					)}
				</Animated.View>
			</ThemedView>

			<TransactionFormModal
				visible={isFormOpen}
				transaction={transaction}
				suggested_date={DateUtils.formatDate(new Date(month_year_selector_values.year, month_year_selector_values.month, new Date().getDate()))}
				onClose={handleCloseForm}
			/>

			<Modal
				visible={Boolean(actions_transaction)}
				transparent
				animationType='fade'
				onRequestClose={() => setActionsTransaction(null)}
			>
				<TouchableOpacity
					style={styles.actionsSheetOverlay}
					activeOpacity={1}
					onPress={() => setActionsTransaction(null)}
				>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_transaction;
								setActionsTransaction(null);
								if (target) setTransaction(target);
							}}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_transaction;
								setActionsTransaction(null);
								if (target) handleDeleteTransaction(target);
							}}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	transactionsContainer: {
		flex: 1,
	},
	header: {
		gap: 16,
	},
	listContainer: {
		flex: 1,
		marginTop: 16,
		overflow: 'hidden',
	},
	listAnimatedContent: {
		flex: 1,
	},
	transactionsList: {
		flex: 1,
	},
	skeletonList: {
		gap: 10,
	},
	transactionItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		padding: 12,
		borderRadius: 10,
	},
	transactionLeft: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	transactionDescription: {
		fontWeight: 'bold',
	},
	transactionUserName: {
		fontSize: 12,
	},
	transactionValue: {
		marginRight: 4,
	},
	actionsButton: {
		padding: 4,
	},
	kindIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 24,
	},
	emptyMessage: {
		fontWeight: '600',
		textAlign: 'center',
	},
	emptySubMessage: {
		color: '#868686',
		textAlign: 'center',
		fontSize: 13,
		lineHeight: 18,
	},
	emptyButton: {
		marginTop: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors['brand-secondary'],
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
	},
	emptyButtonText: {
		color: 'white',
		fontWeight: '600',
	},
	textGreen: {
		color: colors['feedback-success-default'],
	},
	textRed: {
		color: colors['feedback-danger-default'],
	},
	transactionSeparator: {
		height: 8,
	},
	sectionSeparator: {
		height: 16,
	},
	sectionHeader: {
		textTransform: 'uppercase',
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '600',
		color: '#868686',
		marginBottom: 8,
	},
	balanceContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	balanceContainerTransparent: {
		backgroundColor: 'transparent',
	},
	balanceGroup: {
		flexDirection: 'row',
		gap: 20,
		backgroundColor: 'transparent',
	},
	balanceLabel: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: '600',
		textTransform: 'uppercase',
		color: '#868686',
	},
	balanceLabelSmall: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: '600',
		textTransform: 'uppercase',
		color: '#868686',
	},
	balanceValue: {
		fontSize: 16,
		fontWeight: '700',
	},
	actionsSheetOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
	},
	actionsSheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 8,
		paddingBottom: 28,
	},
	actionsSheetItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	actionsSheetItemText: {
		fontSize: 16,
	},
});

export default TransactionsList;
