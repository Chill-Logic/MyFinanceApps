import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';
import { useNavigation } from '@react-navigation/native';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';
import { useIndexCreditCards } from '../../../hooks/api/credit-cards/useIndexCreditCards';
import { useCreateTransactions } from '../../../hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '../../../hooks/api/transactions/useUpdateTransactions';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
import { combineToISO, formatTimeInput, isoToParts, isValidTime, nowParts, toDisplayDate, toISODate } from '../../../utils/datetime';
import { MoneyUtils } from '../../../utils/money';

import { parseOrigin, TNewTransactionForm } from '../../../types/forms';
import { TTransaction, TTransactionKind, TTransactionSourceType } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface TransactionModalProps {
	visible: boolean;
	onClose: ()=> void;
	transaction?: TTransaction | null;
	suggested_date?: string;
}

const DEFAULT_VALUES: TNewTransactionForm = {
	kind: 'deposit',
	description: '',
	value: '',
	transaction_date: '',
	transaction_time: '00:00',
	settled_date: '',
	settled_time: '',
	origin: '',
	credit_card_id: '',
	draft: false,
};

const KIND_OPTIONS = [
	{ label: 'Entrada', value: 'deposit' },
	{ label: 'Saída', value: 'withdraw' },
];

/* Qual campo de data o calendário (que troca de conteúdo dentro do MESMO modal) está editando. */
type TCalendarTarget = 'transaction' | 'settled' | null;

export const TransactionFormModal = (props: TransactionModalProps) => {
	const { visible, onClose, transaction, suggested_date } = props;
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const navigation = useNavigation<{ navigate(route: string): void }>();

	const wallet_id = user_wallet.data?.id;
	const is_editing = Boolean(transaction);

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();

	const [ values, setValues ] = useState<TNewTransactionForm>(DEFAULT_VALUES);
	const [ calendar_target, setCalendarTarget ] = useState<TCalendarTarget>(null);
	/*
	 * Etapa 1 da CRIAÇÃO: tipo de origem escolhido (Conta/Cartão). `null` = ainda na tela de escolha —
	 * evita criar uma transação de cartão sem querer. Na edição vem do próprio transaction (pula a etapa 1).
	 */
	const [ origin_type, setOriginType ] = useState<TTransactionSourceType | null>(null);

	const { source_type, source_id } = parseOrigin(values.origin);
	/* Deriva do TIPO escolhido (não do source_id): vale já na etapa 2, antes de escolher a origem específica. */
	const is_credit = origin_type === 'CreditBalance';

	const { data: accounts_data, isLoading: is_accounts_loading } = useIndexAccounts({
		enabled: visible && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { data: credit_balances_data, isLoading: is_credit_loading } = useIndexCreditBalances({
		enabled: visible && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { data: cards_data, isLoading: is_cards_loading } = useIndexCreditCards({
		enabled: visible && is_credit && Boolean(source_id),
		params: { credit_balance_id: source_id },
	});

	const accounts = accounts_data?.data || [];
	const credit_balances = credit_balances_data?.data || [];
	const cards = cards_data?.data || [];
	const has_origins = accounts.length > 0 || credit_balances.length > 0;
	const is_origins_loading = is_accounts_loading || is_credit_loading;
	const single_card_id = cards.length === 1 ? cards[0].id : null;

	/* Etapa 2 lista SÓ o tipo escolhido (conta OU crédito), sem o prefixo "Conta ·/Crédito ·". */
	const origin_list = is_credit ? credit_balances : accounts;
	const origin_options = [
		...(is_editing ? [] : [ { label: is_credit ? 'Escolha o crédito' : 'Escolha a conta', value: '' } ]),
		...origin_list.map((item) => ({ label: item.name, value: `${ is_credit ? 'CreditBalance' : 'Account' }:${ item.id }` })),
	];

	const card_options = [
		{ label: cards.length ? 'Escolha o cartão' : 'Nenhum cartão neste crédito', value: '' },
		...cards.map((card) => ({ label: card.last_digits ? `${ card.name } ·· ${ card.last_digits }` : card.name, value: card.id })),
	];

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		setCalendarTarget(null);
		setOriginType(null);
		onClose();
	};

	/* Etapa 1 → 2: escolhe o tipo e, se só houver uma origem daquele tipo, já a pré-seleciona. */
	const chooseOriginType = (type: TTransactionSourceType) => {
		const list = type === 'Account' ? accounts : credit_balances;
		setOriginType(type);
		setValues((prev) => ({ ...prev, origin: list.length === 1 ? `${ type }:${ list[0].id }` : '', credit_card_id: '' }));
	};

	/* Volta pra etapa 1 (só na criação), limpando o tipo e a origem escolhida. */
	const backToTypeStep = () => {
		setOriginType(null);
		setValues((prev) => ({ ...prev, origin: '', credit_card_id: '' }));
	};

	const is_pending = is_create_pending || is_update_pending;
	const is_submit_disabled = (
		is_pending ||
		!values.value ||
		!values.description ||
		!values.transaction_date ||
		!isValidTime(values.transaction_time) ||
		(Boolean(values.settled_date) && !isValidTime(values.settled_time)) ||
		(!is_editing && !values.origin) ||
		(is_credit && !values.credit_card_id)
	);

	const handleSave = () => {
		const value = Number(MoneyUtils.unformatMoney(values.value));
		const effective_kind: TTransactionKind = is_credit ? 'withdraw' : values.kind;
		const transaction_date = combineToISO(values.transaction_date, values.transaction_time);
		/*
		 * "Pago em" só é controlável em conta — o crédito é auto-efetivado pelo backend (settled_date =
		 * transaction_date), então nem enviamos o campo (seria sobrescrito). Em conta, vazio = null
		 * (nasce/volta a pendente); com data, manda o instante escolhido — sem a antiga cadeia
		 * create→settle (o backend já aceita `settled_date` direto no body).
		 */
		const account_settled_date = values.settled_date ? combineToISO(values.settled_date, values.settled_time) : null;
		const settled_date = is_credit ? undefined : account_settled_date;

		if (transaction) {
			updateTransactionMutation({
				body: {
					kind: effective_kind,
					description: values.description,
					value,
					transaction_date,
					settled_date,
					credit_card_id: is_credit ? values.credit_card_id : undefined,
					draft: values.draft,
				},
				id: transaction.id,
				onSuccess: () => {
					Toast.show({ type: 'success', text1: 'Transação atualizada!' });
					handleClose();
				},
				onError: (error) => {
					Toast.show({ type: 'error', text1: 'Erro ao atualizar transação!', text2: getApiErrorMessage(error, 'Tente novamente') });
				},
			});
			return;
		}

		createTransactionMutation({
			body: {
				description: values.description,
				value,
				kind: effective_kind,
				transaction_date,
				settled_date: settled_date || undefined,
				source_type: source_type as TTransactionSourceType,
				source_id,
				credit_card_id: is_credit ? values.credit_card_id : undefined,
				draft: values.draft,
			},
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Transação criada!' });
				handleClose();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao criar transação!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	const goToFinances = () => {
		handleClose();
		navigation.navigate('Finances');
	};

	useEffect(() => {
		if (transaction) {
			/* Edição pula a etapa 1: o tipo já vem travado do próprio transaction. */
			setOriginType(transaction.source_type);
			const planned = isoToParts(transaction.transaction_date);
			const paid = transaction.settled_date ? isoToParts(transaction.settled_date) : null;
			setValues({
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: planned.date,
				transaction_time: planned.time,
				settled_date: paid ? paid.date : '',
				settled_time: paid ? paid.time : '',
				origin: `${ transaction.source_type }:${ transaction.source_id }`,
				credit_card_id: transaction.credit_card_id || '',
				draft: transaction.draft,
			});
		} else {
			/* Passou de edição pra criação: volta pra etapa 1 (escolha do tipo). */
			setOriginType(null);
		}
	}, [ transaction ]);

	useEffect(() => {
		if (!transaction) {
			const fallback = suggested_date || DateUtils.formatDate(new Date().toISOString());
			setValues((prev) => ({ ...prev, transaction_date: fallback }));
		}
	}, [ suggested_date, visible, transaction ]);

	/*
	 * Auto-seleciona o único cartão do crédito escolhido, sem sobrescrever uma escolha existente
	 * (edição/seleção manual). Trocar de origem já zera `credit_card_id`, então trocar de crédito
	 * re-dispara isto pro novo cartão único.
	 */
	useEffect(() => {
		if (is_credit && single_card_id) {
			setValues((prev) => (prev.credit_card_id ? prev : { ...prev, credit_card_id: single_card_id }));
		}
	}, [ is_credit, single_card_id ]);

	const renderEmptyState = () => (
		<>
			<ThemedText style={styles.title}>Nova Transação</ThemedText>
			<ThemedView style={styles.emptyState}>
				<Icon name='account-balance' size={40} color={colors['brand-secondary']} />
				<ThemedText style={styles.emptyTitle}>Você ainda não tem contas nem cartões</ThemedText>
				<ThemedText style={styles.emptyMessage}>Toda transação sai de uma conta ou cartão. Crie uma conta para começar a registrar.</ThemedText>
				<TouchableOpacity style={[ styles.button, styles.saveButton, styles.fullButton ]} onPress={goToFinances}>
					<ThemedText style={styles.buttonText}>Criar minha primeira conta</ThemedText>
				</TouchableOpacity>
				<TouchableOpacity style={styles.linkButton} onPress={handleClose}>
					<ThemedText style={styles.linkText}>Cancelar</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</>
	);

	/* Gatilho de data (abre o calendário no mesmo modal) + input mascarado de horário, lado a lado. */
	const renderDateTrigger = (date_value: string, target: Exclude<TCalendarTarget, null>) => (
		<TouchableOpacity
			style={[ styles.dateTrigger, { borderColor: theme.colors.border } ]}
			onPress={() => setCalendarTarget(target)}
			activeOpacity={0.7}
		>
			<ThemedText numberOfLines={1} style={[ styles.dateTriggerText, !date_value && { color: theme.colors.placeholder } ]}>
				{date_value || 'Selecionar'}
			</ThemedText>
			<Icon name='calendar-today' size={16} color={theme.colors.placeholder} />
		</TouchableOpacity>
	);

	/* Etapa 1 (só criação, com origens): escolher o tipo de origem antes de ver as opções. */
	const renderOriginTypeStep = () => (
		<>
			<ThemedText style={styles.title}>Nova Transação</ThemedText>
			<ThemedText style={styles.originQuestion}>De onde sai essa transação?</ThemedText>
			<ThemedView style={styles.originTypeGrid}>
				<TouchableOpacity
					style={[ styles.originTypeButton, { borderColor: theme.colors.border }, !accounts.length && styles.originTypeButtonDisabled ]}
					disabled={!accounts.length}
					onPress={() => chooseOriginType('Account')}
					activeOpacity={0.7}
				>
					<Icon name='account-balance-wallet' size={28} color={colors['brand-secondary']} />
					<ThemedText style={styles.originTypeLabel}>Conta</ThemedText>
					{!accounts.length && <ThemedText style={styles.originTypeHint}>nenhuma conta</ThemedText>}
				</TouchableOpacity>
				<TouchableOpacity
					style={[ styles.originTypeButton, { borderColor: theme.colors.border }, !credit_balances.length && styles.originTypeButtonDisabled ]}
					disabled={!credit_balances.length}
					onPress={() => chooseOriginType('CreditBalance')}
					activeOpacity={0.7}
				>
					<Icon name='credit-card' size={28} color={colors['feedback-info-default']} />
					<ThemedText style={styles.originTypeLabel}>Cartão</ThemedText>
					{!credit_balances.length && <ThemedText style={styles.originTypeHint}>nenhum cartão</ThemedText>}
				</TouchableOpacity>
			</ThemedView>
			<TouchableOpacity style={styles.linkButton} onPress={handleClose}>
				<ThemedText style={styles.linkText}>Cancelar</ThemedText>
			</TouchableOpacity>
		</>
	);

	const renderForm = () => (
		<>
			<ThemedText style={styles.title}>{transaction ? `Editar ${ transaction.kind === 'deposit' ? 'Entrada' : 'Saída' }` : 'Nova Transação'}</ThemedText>

			<ScrollView style={styles.scroll} keyboardShouldPersistTaps='handled'>
				<ThemedView style={styles.formGroup}>
					<ThemedView style={styles.originLabelRow}>
						<ThemedText>{is_credit ? 'Crédito *' : 'Conta *'}</ThemedText>
						{!is_editing && (
							<TouchableOpacity onPress={backToTypeStep} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<ThemedText style={styles.switchTypeText}>← Trocar tipo</ThemedText>
							</TouchableOpacity>
						)}
					</ThemedView>
					<SelectInput
						options={origin_options}
						value={values.origin}
						disabled={is_editing}
						onChange={(origin) => setValues({ ...values, origin, credit_card_id: '' })}
					/>
				</ThemedView>

				{/* Bloco do cartão só depois de um crédito específico selecionado (source_id) — senão o aviso apareceria à toa */}
				{is_credit && source_id && (
					<ThemedView style={styles.formGroup}>
						<SelectInput
							label='Cartão *'
							options={card_options}
							value={values.credit_card_id}
							disabled={!cards.length}
							onChange={(credit_card_id) => setValues({ ...values, credit_card_id })}
						/>
						{!is_cards_loading && !cards.length && (
							<TouchableOpacity onPress={goToFinances}>
								<ThemedText style={styles.cardWarning}>Este crédito não tem cartões. Toque para cadastrar um em Contas & Cartões.</ThemedText>
							</TouchableOpacity>
						)}
					</ThemedView>
				)}

				{!is_credit && (
					<ThemedView style={styles.formGroup}>
						<SelectInput
							label='Tipo *'
							options={KIND_OPTIONS}
							value={values.kind}
							onChange={(value) => setValues({ ...values, kind: value as TTransactionKind })}
						/>
					</ThemedView>
				)}

				<ThemedView style={styles.formGroup}>
					<ThemedTextInput
						label='Descrição *'
						value={values.description}
						onChangeText={(text) => setValues({ ...values, description: text })}
						placeholder='Digite a descrição'
					/>
				</ThemedView>

				<ThemedView style={styles.formGroup}>
					<ThemedTextInput
						label='Valor *'
						value={values.value}
						onChangeText={(text) => setValues({ ...values, value: MoneyUtils.formatMoney(text) })}
						placeholder='R$ 0,00'
						keyboardType='numeric'
					/>
				</ThemedView>

				<ThemedView style={[ styles.formGroup, styles.dateTimeRow ]}>
					<ThemedView style={styles.dateCol}>
						<ThemedText>{is_credit ? 'Data da transação *' : 'Data prevista *'}</ThemedText>
						{renderDateTrigger(values.transaction_date, 'transaction')}
					</ThemedView>
					<ThemedView style={styles.timeCol}>
						<ThemedTextInput
							label='Hora *'
							value={values.transaction_time}
							onChangeText={(text) => setValues((prev) => ({ ...prev, transaction_time: formatTimeInput(text) }))}
							placeholder='HH:MM'
							keyboardType='numeric'
							maxLength={5}
						/>
					</ThemedView>
				</ThemedView>

				{/* "Pago em" só aparece em conta — crédito é efetivado automaticamente pelo backend */}
				{!is_credit && (
					<ThemedView style={styles.formGroup}>
						<ThemedText style={styles.pagoLabel}>
							Pago em <ThemedText style={styles.toggleHint}>— vazio = pendente</ThemedText>
						</ThemedText>
						{values.settled_date ? (
							<ThemedView style={styles.dateTimeRow}>
								<ThemedView style={styles.dateCol}>
									{renderDateTrigger(values.settled_date, 'settled')}
								</ThemedView>
								<ThemedView style={styles.timeCol}>
									<ThemedTextInput
										value={values.settled_time}
										onChangeText={(text) => setValues((prev) => ({ ...prev, settled_time: formatTimeInput(text) }))}
										placeholder='HH:MM'
										keyboardType='numeric'
										maxLength={5}
									/>
								</ThemedView>
								<TouchableOpacity
									style={styles.clearButton}
									onPress={() => setValues((prev) => ({ ...prev, settled_date: '', settled_time: '' }))}
									hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
								>
									<Icon name='close' size={20} color={theme.colors.placeholder} />
								</TouchableOpacity>
							</ThemedView>
						) : (
							<TouchableOpacity
								style={[ styles.markPaidButton, { borderColor: theme.colors.border } ]}
								onPress={() => {
									const now = nowParts();
									setValues((prev) => ({ ...prev, settled_date: now.date, settled_time: now.time }));
								}}
								activeOpacity={0.7}
							>
								<Icon name='event-available' size={18} color={theme.colors.placeholder} />
								<ThemedText style={styles.markPaidText}>Marcar como pago</ThemedText>
							</TouchableOpacity>
						)}
					</ThemedView>
				)}

				<TouchableOpacity
					style={styles.toggleRow}
					onPress={() => setValues((v) => ({ ...v, draft: !v.draft }))}
					activeOpacity={0.7}
				>
					<Icon
						name={values.draft ? 'check-box' : 'check-box-outline-blank'}
						size={22}
						color={colors['brand-secondary']}
					/>
					<ThemedText>Rascunho <ThemedText style={styles.toggleHint}>— planejamento, fora dos totais</ThemedText></ThemedText>
				</TouchableOpacity>
			</ScrollView>

			<ThemedView style={styles.buttonContainer}>
				<TouchableOpacity disabled={is_pending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
					<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
				</TouchableOpacity>
				<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
					<ThemedText style={styles.buttonText}>{is_pending ? <Loader /> : 'Salvar'}</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</>
	);

	const renderCalendar = () => {
		const active_date = calendar_target === 'settled' ? values.settled_date : values.transaction_date;

		return (
			<>
				<ThemedView style={styles.calendarHeader}>
					<TouchableOpacity onPress={() => setCalendarTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						<Icon name='arrow-back' size={22} color={theme.colors.text} />
					</TouchableOpacity>
					<ThemedText style={styles.calendarHeaderTitle}>{calendar_target === 'settled' ? 'Data do pagamento' : 'Data prevista'}</ThemedText>
					<ThemedView style={styles.calendarHeaderSpacer} />
				</ThemedView>

				<Calendar
					current={toISODate(active_date) || undefined}
					onDayPress={(day: DateData) => {
						const display = toDisplayDate(day.dateString);
						setValues((prev) => (
							calendar_target === 'settled'
								? { ...prev, settled_date: display }
								: { ...prev, transaction_date: display }
						));
						setCalendarTarget(null);
					}}
					markedDates={active_date ? {
						[toISODate(active_date)]: { selected: true, selectedColor: colors['brand-secondary'] },
					} : undefined}
					theme={{
						calendarBackground: theme.colors.background,
						dayTextColor: theme.colors.text,
						monthTextColor: theme.colors.text,
						textDisabledColor: theme.colors.placeholder,
						arrowColor: theme.colors.text,
						todayTextColor: colors['brand-secondary'],
						selectedDayBackgroundColor: colors['brand-secondary'],
						selectedDayTextColor: '#fff',
					}}
				/>
			</>
		);
	};

	const renderContent = () => {
		if (calendar_target) return renderCalendar();
		if (!is_editing && !has_origins && !is_origins_loading) return renderEmptyState();
		if (!is_editing && origin_type === null) return renderOriginTypeStep();
		return renderForm();
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={calendar_target ? () => setCalendarTarget(null) : handleClose}
		>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						{renderContent()}
					</ThemedView>
				</ThemedView>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	keyboardAvoider: {
		flex: 1,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		width: '90%',
		maxHeight: '88%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
	},
	scroll: {
		flexGrow: 0,
	},
	calendarHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	calendarHeaderTitle: {
		fontSize: 18,
		fontWeight: '600',
	},
	calendarHeaderSpacer: {
		width: 22,
	},
	dateTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: 50,
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10,
		marginTop: 5,
		gap: 8,
	},
	dateTriggerText: {
		flex: 1,
	},
	title: {
		fontSize: 24,
		marginBottom: 20,
		textAlign: 'center',
	},
	formGroup: {
		marginBottom: 15,
	},
	originLabelRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'transparent',
		marginBottom: 5,
	},
	switchTypeText: {
		color: '#888',
		fontSize: 13,
	},
	originQuestion: {
		textAlign: 'center',
		color: '#888',
		marginBottom: 16,
	},
	originTypeGrid: {
		flexDirection: 'row',
		gap: 12,
		backgroundColor: 'transparent',
	},
	originTypeButton: {
		flex: 1,
		alignItems: 'center',
		gap: 8,
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 24,
		paddingHorizontal: 8,
	},
	originTypeButtonDisabled: {
		opacity: 0.5,
	},
	originTypeLabel: {
		fontSize: 16,
		fontWeight: '600',
	},
	originTypeHint: {
		fontSize: 11,
		color: '#888',
	},
	dateTimeRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
	},
	dateCol: {
		flex: 1.6,
	},
	timeCol: {
		flex: 1,
	},
	clearButton: {
		height: 50,
		marginTop: 5,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 4,
	},
	pagoLabel: {
		marginBottom: 5,
	},
	markPaidButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		height: 50,
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10,
		marginTop: 5,
	},
	markPaidText: {
		color: '#888',
	},
	cardWarning: {
		marginTop: 6,
		fontSize: 12,
		color: colors['feedback-warning-dark'],
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 8,
	},
	toggleHint: {
		color: '#888',
		fontSize: 13,
	},
	emptyState: {
		alignItems: 'center',
		gap: 12,
		paddingVertical: 10,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	emptyMessage: {
		textAlign: 'center',
		color: '#888',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 20,
	},
	button: {
		flex: 1,
		padding: 15,
		borderRadius: 5,
		marginHorizontal: 5,
	},
	fullButton: {
		width: '100%',
		flex: 0,
		alignItems: 'center',
		marginHorizontal: 0,
		marginTop: 8,
	},
	cancelButton: {
		backgroundColor: '#f16f6f',
	},
	saveButton: {
		backgroundColor: colors['brand-secondary'],
	},
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontSize: 16,
	},
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
	linkButton: {
		paddingVertical: 8,
	},
	linkText: {
		color: '#888',
		fontSize: 15,
	},
});

export default TransactionFormModal;
