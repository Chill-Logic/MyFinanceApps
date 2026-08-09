import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useCreateTransactions } from '../../../hooks/api/transactions/useCreateTransactions';

import { useTheme } from '../../../context/theme';
import { DateUtils } from '../../../utils/date';
import { combineToISO, formatTimeInput, isoToParts, isValidTime, nowParts, toDisplayDate, toISODate } from '../../../utils/datetime';
import { MoneyUtils } from '../../../utils/money';

import { TTransaction } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface TransactionDuplicateModalProps {
	visible: boolean;
	onClose: ()=> void;
	/* A transação de referência: tudo (valor, tipo, origem, cartão, rascunho) é copiado dela. */
	transaction: TTransaction | null;
	/* Nome da origem (conta/cartão) só pra exibir no resumo — a origem em si nunca muda ao duplicar. */
	source_name?: string;
}

/* Qual campo de data o calendário (que troca de conteúdo dentro do MESMO modal) está editando. */
type TCalendarTarget = 'transaction' | 'settled' | null;

/*
 * Duplicar = criar uma transação NOVA copiando tudo da original (valor, tipo, origem, cartão, rascunho),
 * deixando editável só a descrição e a data prevista — pensado pra cobranças recorrentes. Em conta, o
 * "Pago em" também é editável (opcional, mesma condicional do form normal) e começa vazio: a cópia nasce
 * pendente por padrão. Em crédito não há "Pago em" (o backend auto-efetiva).
 */
export const TransactionDuplicateModal = (props: TransactionDuplicateModalProps) => {
	const { visible, onClose, transaction, source_name } = props;
	const { theme } = useTheme();

	const { mutate: createTransactionMutation, isPending: is_pending } = useCreateTransactions();

	const [ description, setDescription ] = useState('');
	const [ transaction_date, setTransactionDate ] = useState('');
	const [ transaction_time, setTransactionTime ] = useState('00:00');
	const [ settled_date, setSettledDate ] = useState('');
	const [ settled_time, setSettledTime ] = useState('');
	const [ calendar_target, setCalendarTarget ] = useState<TCalendarTarget>(null);

	const is_credit = transaction?.source_type === 'CreditBalance';
	const is_deposit = transaction?.kind === 'deposit';

	useEffect(() => {
		if (!visible || !transaction) return;

		const planned = isoToParts(transaction.transaction_date);
		/* Default +1 mês, mesmo dia e horário da original — pensado pra cobrança recorrente do mês seguinte. */
		const next_month = DateUtils.addMonths(transaction.transaction_date, 1);
		setDescription(transaction.description);
		setTransactionDate(next_month ? DateUtils.formateTo(next_month, 'dd/MM/yyyy') : planned.date);
		setTransactionTime(planned.time);
		setSettledDate(''); // cópia nasce pendente; o usuário marca como pago se quiser
		setSettledTime('');
		setCalendarTarget(null);
	}, [ visible, transaction ]);

	const handleClose = () => {
		setCalendarTarget(null);
		onClose();
	};

	const is_submit_disabled = (
		is_pending ||
		!description ||
		!transaction_date ||
		!isValidTime(transaction_time) ||
		(Boolean(settled_date) && !isValidTime(settled_time))
	);

	const handleSave = () => {
		if (!transaction) return;

		const account_settled_date = settled_date ? combineToISO(settled_date, settled_time) : undefined;

		createTransactionMutation({
			body: {
				description,
				value: transaction.value,
				kind: transaction.kind,
				transaction_date: combineToISO(transaction_date, transaction_time),
				/* Crédito é auto-efetivado pelo backend — não enviamos o campo (seria sobrescrito). */
				settled_date: is_credit ? undefined : account_settled_date,
				source_type: transaction.source_type,
				source_id: transaction.source_id,
				credit_card_id: is_credit ? (transaction.credit_card_id || undefined) : undefined,
				draft: transaction.draft,
			},
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Transação duplicada!' });
				handleClose();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao duplicar transação!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	/* Gatilho de data (abre o calendário no mesmo modal) — espelha o do TransactionFormModal. */
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

	const renderCalendar = () => {
		const active_date = calendar_target === 'settled' ? settled_date : transaction_date;

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
						if (calendar_target === 'settled') setSettledDate(display);
						else setTransactionDate(display);
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

	const renderForm = () => (
		<>
			<ThemedText style={styles.title}>Duplicar transação</ThemedText>

			<ScrollView style={styles.scroll} keyboardShouldPersistTaps='handled'>
				{/* Resumo do que é copiado da original (não editável) */}
				{transaction && (
					<View style={[ styles.summary, { borderColor: theme.colors.border } ]}>
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
						<View style={styles.summaryTextCol}>
							<View style={styles.summaryOriginRow}>
								<Icon name={is_credit ? 'credit-card' : 'account-balance-wallet'} size={13} color={theme.colors.placeholder} />
								<ThemedText style={styles.summaryOrigin} numberOfLines={1}>{source_name || (is_credit ? 'Crédito' : 'Conta')}</ThemedText>
								{transaction.draft && <ThemedText style={styles.draftBadge}>Rascunho</ThemedText>}
							</View>
							<ThemedText style={[ styles.summaryValue, is_deposit ? styles.textGreen : styles.textRed ]}>
								{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction.value)}
							</ThemedText>
						</View>
					</View>
				)}

				<ThemedView style={styles.formGroup}>
					<ThemedTextInput
						label='Descrição *'
						value={description}
						onChangeText={setDescription}
						placeholder='Digite a descrição'
					/>
				</ThemedView>

				<ThemedView style={[ styles.formGroup, styles.dateTimeRow ]}>
					<ThemedView style={styles.dateCol}>
						<ThemedText>{is_credit ? 'Data da transação *' : 'Data prevista *'}</ThemedText>
						{renderDateTrigger(transaction_date, 'transaction')}
					</ThemedView>
					<ThemedView style={styles.timeCol}>
						<ThemedTextInput
							label='Hora *'
							value={transaction_time}
							onChangeText={(text) => setTransactionTime(formatTimeInput(text))}
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
						{settled_date ? (
							<ThemedView style={styles.dateTimeRow}>
								<ThemedView style={styles.dateCol}>
									{renderDateTrigger(settled_date, 'settled')}
								</ThemedView>
								<ThemedView style={styles.timeCol}>
									<ThemedTextInput
										value={settled_time}
										onChangeText={(text) => setSettledTime(formatTimeInput(text))}
										placeholder='HH:MM'
										keyboardType='numeric'
										maxLength={5}
									/>
								</ThemedView>
								<TouchableOpacity
									style={styles.clearButton}
									onPress={() => { setSettledDate(''); setSettledTime(''); }}
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
									setSettledDate(now.date);
									setSettledTime(now.time);
								}}
								activeOpacity={0.7}
							>
								<Icon name='event-available' size={18} color={theme.colors.placeholder} />
								<ThemedText style={styles.markPaidText}>Marcar como pago</ThemedText>
							</TouchableOpacity>
						)}
					</ThemedView>
				)}
			</ScrollView>

			<ThemedView style={styles.buttonContainer}>
				<TouchableOpacity disabled={is_pending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
					<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
				</TouchableOpacity>
				<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
					<ThemedText style={styles.buttonText}>{is_pending ? <Loader /> : 'Duplicar'}</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</>
	);

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
						{calendar_target ? renderCalendar() : renderForm()}
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
	title: {
		fontSize: 24,
		marginBottom: 20,
		textAlign: 'center',
	},
	summary: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		marginBottom: 15,
	},
	kindIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	summaryTextCol: {
		flex: 1,
		gap: 2,
	},
	summaryOriginRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
	},
	summaryOrigin: {
		flexShrink: 1,
		fontSize: 12,
		color: '#868686',
	},
	summaryValue: {
		fontSize: 16,
		fontWeight: '700',
	},
	draftBadge: {
		fontSize: 10,
		lineHeight: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		color: '#868686',
		backgroundColor: 'rgba(255, 255, 255, 0.10)',
		borderRadius: 4,
		paddingHorizontal: 5,
		paddingVertical: 1,
		overflow: 'hidden',
	},
	textGreen: {
		color: colors['feedback-success-default'],
	},
	textRed: {
		color: colors['feedback-danger-default'],
	},
	formGroup: {
		marginBottom: 15,
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
	toggleHint: {
		color: '#888',
		fontSize: 13,
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
	cancelButton: {
		backgroundColor: '#f16f6f',
	},
	saveButton: {
		backgroundColor: colors['brand-secondary'],
	},
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontSize: 16,
	},
});

export default TransactionDuplicateModal;
