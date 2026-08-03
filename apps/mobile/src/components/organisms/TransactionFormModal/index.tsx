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
import { useSettleTransaction } from '../../../hooks/api/transactions/useSettleTransaction';
import { useUpdateTransactions } from '../../../hooks/api/transactions/useUpdateTransactions';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
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
	origin: '',
	credit_card_id: '',
	pending: false,
	draft: false,
};

const KIND_OPTIONS = [
	{ label: 'Entrada', value: 'deposit' },
	{ label: 'Saída', value: 'withdraw' },
];

/**
 * Conversão puramente textual (sem passar por Date/toISOString) de propósito — evitar
 * qualquer risco de o fuso horário deslocar o dia, já que aqui só interessa o valor
 * exibido/selecionado no calendário, não um instante no tempo.
 */
const toISODate = (display_date: string) => {
	const [ day, month, year ] = display_date.split('/');
	if (!day || !month || !year) return '';
	return `${ year }-${ month }-${ day }`;
};

const toDisplayDate = (iso_date: string) => {
	const [ year, month, day ] = iso_date.split('-');
	return `${ day }/${ month }/${ year }`;
};

export const TransactionFormModal = (props: TransactionModalProps) => {
	const { visible, onClose, transaction, suggested_date } = props;
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const navigation = useNavigation<{ navigate(route: string): void }>();

	const wallet_id = user_wallet.data?.id;
	const is_editing = Boolean(transaction);

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();
	const { mutate: settleTransactionMutation, isPending: is_settle_pending } = useSettleTransaction();

	const [ values, setValues ] = useState<TNewTransactionForm>(DEFAULT_VALUES);
	const [ is_calendar_visible, setIsCalendarVisible ] = useState(false);

	const { source_type, source_id } = parseOrigin(values.origin);
	const is_credit = source_type === 'CreditBalance';

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

	const origin_options = [
		...(is_editing ? [] : [ { label: 'Escolha a conta ou cartão', value: '' } ]),
		...accounts.map((account) => ({ label: `Conta · ${ account.name }`, value: `Account:${ account.id }` })),
		...credit_balances.map((credit_balance) => ({ label: `Crédito · ${ credit_balance.name }`, value: `CreditBalance:${ credit_balance.id }` })),
	];

	const card_options = [
		{ label: cards.length ? 'Escolha o cartão' : 'Nenhum cartão neste crédito', value: '' },
		...cards.map((card) => ({ label: card.last_digits ? `${ card.name } ·· ${ card.last_digits }` : card.name, value: card.id })),
	];

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		setIsCalendarVisible(false);
		onClose();
	};

	const is_pending = is_create_pending || is_update_pending || is_settle_pending;
	const is_submit_disabled = (
		is_pending ||
		!values.value ||
		!values.description ||
		!values.transaction_date ||
		(!is_editing && !values.origin) ||
		(is_credit && !values.credit_card_id)
	);

	const handleSave = () => {
		const value = Number(MoneyUtils.unformatMoney(values.value));
		const effective_kind: TTransactionKind = is_credit ? 'withdraw' : values.kind;
		const transaction_date = DateUtils.formatDateToISO(values.transaction_date);

		if (transaction) {
			updateTransactionMutation({
				body: {
					kind: effective_kind,
					description: values.description,
					value,
					transaction_date,
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
				source_type: source_type as TTransactionSourceType,
				source_id,
				credit_card_id: is_credit ? values.credit_card_id : undefined,
				draft: values.draft,
			},
			onSuccess: (created) => {
				/*
				 * O backend cria toda transação como pendente (não aceita efetivar no create). Se o
				 * usuário não marcou "pendente" nem "rascunho", efetivamos logo em seguida.
				 */
				if (!values.draft && !values.pending) {
					settleTransactionMutation({
						id: created.id,
						onSuccess: () => {
							Toast.show({ type: 'success', text1: 'Transação criada e efetivada!' });
							handleClose();
						},
						onError: () => {
							Toast.show({ type: 'success', text1: 'Transação criada como pendente' });
							handleClose();
						},
					});
					return;
				}
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
			setValues({
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: DateUtils.formatDate(transaction.transaction_date),
				origin: `${ transaction.source_type }:${ transaction.source_id }`,
				credit_card_id: transaction.credit_card_id || '',
				pending: !transaction.settled,
				draft: transaction.draft,
			});
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

	const renderForm = () => (
		<>
			<ThemedText style={styles.title}>{transaction ? `Editar ${ transaction.kind === 'deposit' ? 'Entrada' : 'Saída' }` : 'Nova Transação'}</ThemedText>

			<ScrollView style={styles.scroll} keyboardShouldPersistTaps='handled'>
				<ThemedView style={styles.formGroup}>
					<SelectInput
						label='Origem *'
						options={origin_options}
						value={values.origin}
						disabled={is_editing}
						onChange={(origin) => setValues({ ...values, origin, credit_card_id: '' })}
					/>
				</ThemedView>

				{is_credit && (
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

				<ThemedView style={styles.formGroupDate}>
					<ThemedView style={styles.fieldContainer}>
						<ThemedTextInput
							label='Valor *'
							value={values.value}
							onChangeText={(text) => setValues({ ...values, value: MoneyUtils.formatMoney(text) })}
							placeholder='R$ 0,00'
							keyboardType='numeric'
						/>
					</ThemedView>

					<ThemedView style={styles.fieldContainer}>
						<ThemedText style={styles.dateTriggerLabel}>Data *</ThemedText>
						<TouchableOpacity
							style={[ styles.dateTrigger, { borderColor: theme.colors.border } ]}
							onPress={() => setIsCalendarVisible(true)}
							activeOpacity={0.7}
						>
							<ThemedText numberOfLines={1} style={[ styles.dateTriggerText, !values.transaction_date && { color: theme.colors.placeholder } ]}>
								{values.transaction_date || 'Selecionar'}
							</ThemedText>
							<Icon name='calendar-today' size={16} color={theme.colors.placeholder} />
						</TouchableOpacity>
					</ThemedView>
				</ThemedView>

				<TouchableOpacity
					style={styles.toggleRow}
					onPress={() => setValues((v) => ({ ...v, pending: !v.pending }))}
					disabled={values.draft}
					activeOpacity={0.7}
				>
					<Icon
						name={values.pending ? 'check-box' : 'check-box-outline-blank'}
						size={22}
						color={values.draft ? theme.colors.placeholder : colors['brand-secondary']}
					/>
					<ThemedText style={values.draft ? styles.toggleDisabled : undefined}>
						Pendente <ThemedText style={styles.toggleHint}>— ainda não efetivada</ThemedText>
					</ThemedText>
				</TouchableOpacity>

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

	const renderCalendar = () => (
		<>
			<ThemedView style={styles.calendarHeader}>
				<TouchableOpacity onPress={() => setIsCalendarVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='arrow-back' size={22} color={theme.colors.text} />
				</TouchableOpacity>
				<ThemedText style={styles.calendarHeaderTitle}>Selecionar data</ThemedText>
				<ThemedView style={styles.calendarHeaderSpacer} />
			</ThemedView>

			<Calendar
				current={toISODate(values.transaction_date) || undefined}
				onDayPress={(day: DateData) => {
					setValues((prev) => ({ ...prev, transaction_date: toDisplayDate(day.dateString) }));
					setIsCalendarVisible(false);
				}}
				markedDates={values.transaction_date ? {
					[toISODate(values.transaction_date)]: { selected: true, selectedColor: colors['brand-secondary'] },
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

	const renderContent = () => {
		if (is_calendar_visible) return renderCalendar();
		if (!is_editing && !has_origins && !is_origins_loading) return renderEmptyState();
		return renderForm();
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={is_calendar_visible ? () => setIsCalendarVisible(false) : handleClose}
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
	dateTriggerLabel: {
		marginBottom: 5,
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
	formGroupDate: {
		marginBottom: 15,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	fieldContainer: {
		flex: 1,
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
	toggleDisabled: {
		color: '#888',
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
