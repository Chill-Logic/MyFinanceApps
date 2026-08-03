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
import { useNavigation } from '@react-navigation/native';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteTransactions } from '../../../hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '../../../hooks/api/transactions/useListTransactions';
import { useSettleTransaction } from '../../../hooks/api/transactions/useSettleTransaction';
import { useUnsettleTransaction } from '../../../hooks/api/transactions/useUnsettleTransaction';

import { useMonthSelection } from '../../../context/monthSelection';
import { useNewTransactionDialog } from '../../../context/newTransactionDialog';
import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
import { MoneyUtils } from '../../../utils/money';

import { TTransaction, TTransactionSourceType } from '../../../types/models';

import MonthYearSelector from '../../atoms/MonthYearSelector';
import SegmentedControl from '../../atoms/SegmentedControl';
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

/* Abas por TIPO de origem (mesma separação do web) — o backend traz o mês inteiro, filtramos no cliente. */
const SOURCE_TABS: { id: TTransactionSourceType; label: string; icon: string }[] = [
	{ id: 'Account', label: 'Contas', icon: 'account-balance-wallet' },
	{ id: 'CreditBalance', label: 'Cartões', icon: 'credit-card' },
];

/*
 * Resumo calculado no cliente (espelha o web e o backend): efetivado = entre os não-rascunho E
 * efetivados, entradas − saídas; previsto = entre todos os não-rascunho; conta os pendentes; rascunhos
 * ficam fora dos dois. Funciona pra qualquer recorte (todas as origens ou uma aba) sem depender do
 * `total_settled`/`total_projected` da resposta (que é sempre "de tudo").
 */
const buildSummary = (items: TTransaction[]) => {
	const non_draft = items.filter((item) => !item.draft);
	const balance = (list: TTransaction[]) => (
		list.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0)
		- list.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0)
	);

	const deposit = non_draft.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0);
	const withdraw = non_draft.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0);
	const projected = balance(non_draft);
	const settled = balance(non_draft.filter((i) => i.settled));
	const pending = non_draft.filter((i) => !i.settled).length;

	return { deposit, withdraw, settled, projected, gap: projected !== settled, pending };
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
	const navigation = useNavigation<{ navigate(route: string): void }>();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const { month_year_selector_values, setMonthYearSelectorValues } = useMonthSelection();

	/* Mês de referência no formato YYYY-MM (mês é 0-indexado no contexto, +1 pro calendário). */
	const reference = `${ month_year_selector_values.year }-${ String(month_year_selector_values.month + 1).padStart(2, '0') }`;

	/*
	 * `enabled` amarrado à presença do `wallet_id`: sem isso, a query dispara com `wallet_id: ''`
	 * enquanto a carteira ainda está carregando (o fallback `|| ''` NÃO segura a requisição, só
	 * troca o valor), e o backend responde 422 "Carteira não encontrada". Mesmo padrão já
	 * documentado no web: query cujo parâmetro depende de outro dado assíncrono precisa de
	 * `enabled` nesse dado, não só de um fallback.
	 */
	const wallet_id = user_wallet.data?.id;

	const { data: data_transactions, isLoading: is_data_transactions_loading } = useListTransactions({
		enabled: Boolean(wallet_id),
		params: {
			wallet_id: wallet_id || '',
			reference,
		},
	});

	/* Contas/créditos: resolvem o nome da origem por linha e guiam o empty-state de cada aba. */
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });

	const accounts = useMemo(() => accounts_data?.data || [], [ accounts_data ]);
	const credit_balances = useMemo(() => credit_balances_data?.data || [], [ credit_balances_data ]);

	const source_names = useMemo(() => {
		const map = new Map<string, string>();
		accounts.forEach((account) => map.set(account.id, account.name));
		credit_balances.forEach((credit_balance) => map.set(credit_balance.id, credit_balance.name));
		return map;
	}, [ accounts, credit_balances ]);

	const [ transaction, setTransaction ] = useState<TTransaction | null>(null);
	const [ actions_transaction, setActionsTransaction ] = useState<TTransaction | null>(null);
	const [ source_type, setSourceType ] = useState<TTransactionSourceType>('Account');

	const { mutate: settleTransaction } = useSettleTransaction();
	const { mutate: unsettleTransaction } = useUnsettleTransaction();

	const handleToggleSettle = (transaction_item: TTransaction) => {
		if (transaction_item.settled) {
			unsettleTransaction({
				id: transaction_item.id,
				onSuccess: () => Toast.show({ type: 'success', text1: 'Efetivação desfeita' }),
				onError: (error) => Toast.show({ type: 'error', text1: 'Não foi possível desfazer', text2: getApiErrorMessage(error, 'Tente novamente') }),
			});
			return;
		}
		settleTransaction({
			id: transaction_item.id,
			onSuccess: () => Toast.show({ type: 'success', text1: 'Transação efetivada' }),
			onError: (error) => Toast.show({ type: 'error', text1: 'Não foi possível efetivar', text2: getApiErrorMessage(error, 'Tente novamente') }),
		});
	};

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

	const all_transactions = useMemo(() => data_transactions?.data || [], [ data_transactions ]);
	const transactions = useMemo(() => all_transactions.filter((item) => item.source_type === source_type), [ all_transactions, source_type ]);
	const groups = useMemo(() => groupTransactionsByDay(transactions), [ transactions ]);
	const sources_of_type = source_type === 'Account' ? accounts : credit_balances;

	/*
	 * Total do mês = TODAS as origens (a aba filtra só a lista, não o card de total — mesmo comportamento
	 * do web no mobile). `grand.settled` = saldo efetivado; `grand.projected` = previsto (inclui pendentes);
	 * rascunhos ficam fora dos dois.
	 */
	const grand = useMemo(() => buildSummary(all_transactions), [ all_transactions ]);

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
					name={is_deposit ? 'north-east' : 'south-east'}
					size={16}
					color={is_deposit ? colors['feedback-success-dark'] : colors['feedback-danger-dark']}
				/>
			</View>
		);
	};

	/*
	 * Meta por linha (espelha o `renderMeta` do web): chip com o NOME da origem (qual conta/crédito),
	 * colorido por tipo, + selos de estado (Rascunho/Pendente). Dentro de uma aba há vários sources
	 * misturados, então o chip é o que diz de onde cada transação saiu.
	 */
	const renderTransactionMeta = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const name = source_names.get(transaction_item.source_id) || (is_credit ? 'Crédito' : 'Conta');
		const is_pending = !transaction_item.draft && !transaction_item.settled;
		const chip_color = is_credit ? colors['feedback-info-default'] : colors['brand-secondary'];

		return (
			<View style={styles.metaRow}>
				<View style={[ styles.originChip, { borderColor: chip_color } ]}>
					<Icon name={is_credit ? 'credit-card' : 'account-balance-wallet'} size={11} color={chip_color} />
					<ThemedText style={[ styles.originChipText, { color: chip_color } ]} numberOfLines={1}>{name}</ThemedText>
				</View>
				{transaction_item.draft && <ThemedText style={[ styles.stateBadge, styles.draftBadge ]}>Rascunho</ThemedText>}
				{is_pending && <ThemedText style={[ styles.stateBadge, styles.pendingBadge ]}>Pendente</ThemedText>}
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
				<ThemedText style={styles.transactionDescription} numberOfLines={1}>{transaction_item.description}</ThemedText>
				{renderTransactionMeta(transaction_item)}
			</ThemedView>

			<ThemedText
				style={[
					styles.transactionValue,
					getTransactionColor(transaction_item.kind),
				]}
			>
				{transaction_item.kind === 'deposit' ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
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

				<ThemedView style={[ styles.balanceContainer, { backgroundColor: card_surface, borderColor: card_surface } ]}>
					<ThemedView style={styles.balanceTopRow}>
						<ThemedView style={styles.balanceContainerTransparent}>
							<ThemedText style={styles.balanceLabel}>Saldo efetivado</ThemedText>
							{is_data_transactions_loading ? <Skeleton height={20} width={90} /> : (
								<ThemedText style={[ styles.balanceValue, grand.settled >= 0 ? styles.textGreen : styles.textRed ]}>
									{MoneyUtils.formatMoney(grand.settled)}
								</ThemedText>
							)}
						</ThemedView>

						{!is_data_transactions_loading && (
							<ThemedView style={styles.previstoBox}>
								<ThemedText style={styles.balanceLabelSmall}>Previsto</ThemedText>
								<ThemedText style={[ styles.previstoValue, grand.gap ? { color: colors['feedback-warning-dark'] } : { color: theme.colors.text } ]}>
									{MoneyUtils.formatMoney(grand.projected)}
								</ThemedText>
								{grand.pending > 0 && (
									<ThemedText style={styles.pendingCount}>{grand.pending} pendente{grand.pending > 1 ? 's' : ''}</ThemedText>
								)}
							</ThemedView>
						)}
					</ThemedView>

					<ThemedView style={styles.balanceGroup}>
						<ThemedView style={styles.balanceContainerTransparent}>
							<ThemedText style={styles.balanceLabelSmall}>Entrada</ThemedText>
							{is_data_transactions_loading ? <Skeleton height={16} width={64} /> : (
								<ThemedText style={styles.textGreen}>{MoneyUtils.formatMoney(grand.deposit)}</ThemedText>
							)}
						</ThemedView>

						<ThemedView style={styles.balanceContainerTransparent}>
							<ThemedText style={styles.balanceLabelSmall}>Saída</ThemedText>
							{is_data_transactions_loading ? <Skeleton height={16} width={64} /> : (
								<ThemedText style={styles.textRed}>{MoneyUtils.formatMoney(grand.withdraw)}</ThemedText>
							)}
						</ThemedView>
					</ThemedView>
				</ThemedView>

				<SegmentedControl
					segments={SOURCE_TABS.map((tab) => ({ value: tab.id, label: tab.label, icon: tab.icon }))}
					value={source_type}
					onChange={(next) => setSourceType(next as TTransactionSourceType)}
				/>
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

					{!is_data_transactions_loading && groups.length === 0 && sources_of_type.length === 0 && (
						<ThemedView style={styles.emptyContainer}>
							<Icon name={source_type === 'Account' ? 'account-balance-wallet' : 'credit-card'} size={40} color={theme.colors.placeholder} />
							<ThemedText style={styles.emptyMessage}>
								{source_type === 'Account' ? 'Nenhuma conta ainda' : 'Nenhum cartão de crédito ainda'}
							</ThemedText>
							<ThemedText style={styles.emptySubMessage}>
								Crie {source_type === 'Account' ? 'uma conta' : 'um crédito'} em Contas & Cartões para ver as transações aqui.
							</ThemedText>
							<TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Finances')}>
								<Icon name='arrow-forward' size={18} color='white' />
								<ThemedText style={styles.emptyButtonText}>Ir para Contas & Cartões</ThemedText>
							</TouchableOpacity>
						</ThemedView>
					)}

					{!is_data_transactions_loading && groups.length === 0 && sources_of_type.length > 0 && (
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
						{actions_transaction && !actions_transaction.draft && (
							<TouchableOpacity
								style={styles.actionsSheetItem}
								onPress={() => {
									const target = actions_transaction;
									setActionsTransaction(null);
									if (target) handleToggleSettle(target);
								}}
							>
								<Icon
									name={actions_transaction.settled ? 'radio-button-unchecked' : 'check-circle'}
									size={20}
									color={actions_transaction.settled ? theme.colors.placeholder : colors['feedback-success-default']}
								/>
								<ThemedText style={styles.actionsSheetItemText}>{actions_transaction.settled ? 'Desfazer efetivação' : 'Efetivar'}</ThemedText>
							</TouchableOpacity>
						)}

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
		gap: 10,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	balanceTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		backgroundColor: 'transparent',
	},
	balanceContainerTransparent: {
		backgroundColor: 'transparent',
	},
	previstoBox: {
		alignItems: 'flex-end',
		backgroundColor: 'transparent',
	},
	previstoValue: {
		fontWeight: '600',
	},
	pendingCount: {
		fontSize: 11,
		color: colors['feedback-warning-dark'],
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 3,
		backgroundColor: 'transparent',
	},
	originChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		maxWidth: 160,
		borderWidth: 1,
		borderRadius: 100,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	originChipText: {
		fontSize: 11,
		fontWeight: '500',
	},
	stateBadge: {
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		borderRadius: 4,
		paddingHorizontal: 5,
		paddingVertical: 1,
		overflow: 'hidden',
	},
	draftBadge: {
		color: '#868686',
		backgroundColor: 'rgba(255, 255, 255, 0.10)',
	},
	pendingBadge: {
		color: colors['feedback-warning-dark'],
		backgroundColor: colors['feedback-warning-light'],
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
