import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { usePayInvoice } from '../../../hooks/api/credit-balances/usePayInvoice';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';
import { combineToISO, formatTimeInput, isValidTime, nowParts, toDisplayDate, toISODate } from '../../../utils/datetime';

import { TCreditBalance, TCurrentInvoice } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface PayInvoiceModalProps {
	visible: boolean;
	onClose: ()=> void;
	creditBalance: TCreditBalance;
	invoice?: TCurrentInvoice;
	/* Data (YYYY-MM-DD) dentro do ciclo a pagar — mira a fatura exibida, não o ciclo de hoje. */
	date?: string;
}

export const PayInvoiceModal = (props: PayInvoiceModalProps) => {
	const { visible, onClose, creditBalance, invoice, date } = props;
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data: accounts_data } = useIndexAccounts({
		enabled: visible && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: payInvoiceMutation, isPending } = usePayInvoice();

	const [ account_id, setAccountId ] = useState('');
	/* Valor do pagamento (string formatada); default = saldo restante da fatura. Permite pagamento parcial. */
	const [ value, setValue ] = useState('');
	/* "Pago em" — quando o pagamento foi efetivado (data + hora); default = agora. Vai como `settled_date`. */
	const [ settled_date, setSettledDate ] = useState('');
	const [ settled_time, setSettledTime ] = useState('');
	const [ is_calendar_visible, setIsCalendarVisible ] = useState(false);

	const accounts = useMemo(() => accounts_data?.data || [], [ accounts_data ]);

	const invoice_amount = invoice?.amount ?? 0;
	const paid_amount = invoice?.paid_amount ?? 0;
	const remaining = invoice?.remaining ?? invoice_amount;

	/* Pré-seleciona a primeira conta e preenche o valor com o restante quando o modal abre. */
	useEffect(() => {
		if (visible && !account_id && accounts.length > 0) {
			setAccountId(accounts[0].id);
		}
	}, [ visible, account_id, accounts ]);

	useEffect(() => {
		if (visible) setValue(MoneyUtils.formatMoney(remaining));
	}, [ visible, remaining ]);

	/* Ao abrir, pré-preenche "Pago em" com o momento atual (caso mais comum: pagou agora). */
	useEffect(() => {
		if (visible) {
			const now = nowParts();
			setSettledDate(now.date);
			setSettledTime(now.time);
		}
	}, [ visible ]);

	const value_cents = Number(MoneyUtils.unformatMoney(value));

	const handleClose = () => {
		setAccountId('');
		setValue('');
		setSettledDate('');
		setSettledTime('');
		setIsCalendarVisible(false);
		onClose();
	};

	const handlePay = () => {
		if (!account_id) {
			Toast.show({ type: 'error', text1: 'Escolha a conta pagadora' });
			return;
		}
		if (value_cents <= 0) {
			Toast.show({ type: 'error', text1: 'Informe um valor maior que zero' });
			return;
		}
		if (!settled_date || !isValidTime(settled_time)) {
			Toast.show({ type: 'error', text1: 'Informe a data e o horário do pagamento' });
			return;
		}

		payInvoiceMutation({
			body: { account_id, value: value_cents, settled_date: combineToISO(settled_date, settled_time), ...(date ? { date } : {}) },
			id: creditBalance.id,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Pagamento registrado!' });
				handleClose();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao pagar fatura!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	const has_accounts = accounts.length > 0;

	const renderCalendar = () => (
		<>
			<ThemedView style={styles.calendarHeader}>
				<TouchableOpacity onPress={() => setIsCalendarVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='arrow-back' size={22} color={theme.colors.text} />
				</TouchableOpacity>
				<ThemedText style={styles.calendarHeaderTitle}>Data do pagamento</ThemedText>
				<ThemedView style={styles.calendarHeaderSpacer} />
			</ThemedView>

			<Calendar
				current={toISODate(settled_date) || undefined}
				onDayPress={(day: DateData) => {
					setSettledDate(toDisplayDate(day.dateString));
					setIsCalendarVisible(false);
				}}
				markedDates={settled_date ? {
					[toISODate(settled_date)]: { selected: true, selectedColor: colors['brand-secondary'] },
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

	const renderForm = () => (
		<>
			<ThemedText style={styles.title}>Pagar fatura</ThemedText>

			<ThemedText style={styles.amount}>{MoneyUtils.formatMoney(invoice_amount)}</ThemedText>
			<ThemedText style={styles.subtitle}>{creditBalance.name}</ThemedText>

			{paid_amount > 0 && (
				<ThemedView style={styles.breakdown}>
					<ThemedView style={styles.breakdownRow}>
						<ThemedText style={styles.breakdownLabel}>Já pago</ThemedText>
						<ThemedText style={styles.breakdownPaid}>{MoneyUtils.formatMoney(paid_amount)}</ThemedText>
					</ThemedView>
					<ThemedView style={styles.breakdownRow}>
						<ThemedText style={styles.breakdownLabel}>Restante</ThemedText>
						<ThemedText style={styles.breakdownRemaining}>{MoneyUtils.formatMoney(remaining)}</ThemedText>
					</ThemedView>
				</ThemedView>
			)}

			{has_accounts ? (
				<>
					<ThemedView style={styles.formGroup}>
						<SelectInput
							label='Conta pagadora *'
							options={accounts.map((account) => ({ label: account.name, value: account.id }))}
							value={account_id}
							onChange={setAccountId}
						/>
					</ThemedView>

					<ThemedView style={styles.formGroup}>
						<ThemedTextInput
							label='Valor do pagamento *'
							value={value}
							onChangeText={(text) => setValue(MoneyUtils.formatMoney(text))}
							placeholder='R$ 0,00'
							keyboardType='numeric'
						/>
						<ThemedText style={styles.hint}>Pode ser parcial — o restante fica em aberto pra pagar depois.</ThemedText>
					</ThemedView>

					<ThemedView style={[ styles.formGroup, styles.dateTimeRow ]}>
						<ThemedView style={styles.dateCol}>
							<ThemedText>Pago em *</ThemedText>
							<TouchableOpacity
								style={[ styles.dateTrigger, { borderColor: theme.colors.border } ]}
								onPress={() => setIsCalendarVisible(true)}
								activeOpacity={0.7}
							>
								<ThemedText numberOfLines={1} style={[ styles.dateTriggerText, !settled_date && { color: theme.colors.placeholder } ]}>
									{settled_date || 'Selecionar'}
								</ThemedText>
								<Icon name='calendar-today' size={16} color={theme.colors.placeholder} />
							</TouchableOpacity>
						</ThemedView>
						<ThemedView style={styles.timeCol}>
							<ThemedTextInput
								label='Hora *'
								value={settled_time}
								onChangeText={(text) => setSettledTime(formatTimeInput(text))}
								placeholder='HH:MM'
								keyboardType='numeric'
								maxLength={5}
							/>
						</ThemedView>
					</ThemedView>
				</>
			) : (
				<ThemedText style={styles.warning}>Você precisa de uma conta para pagar a fatura.</ThemedText>
			)}

			<ThemedView style={styles.buttonContainer}>
				<TouchableOpacity disabled={isPending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
					<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
				</TouchableOpacity>
				<TouchableOpacity
					disabled={isPending || !has_accounts || value_cents <= 0}
					style={[ styles.button, (isPending || !has_accounts || value_cents <= 0) ? styles.saveButtonDisabled : styles.saveButton ]}
					onPress={handlePay}
				>
					<ThemedText style={styles.buttonText}>{isPending ? <Loader /> : `Pagar ${ MoneyUtils.formatMoney(value_cents) }`}</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</>
	);

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
						{is_calendar_visible ? renderCalendar() : renderForm()}
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
		maxHeight: '90%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
	},
	title: {
		fontSize: 24,
		marginBottom: 8,
		textAlign: 'center',
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
	amount: {
		fontSize: 28,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	subtitle: {
		textAlign: 'center',
		color: '#888',
		marginBottom: 16,
	},
	breakdown: {
		gap: 6,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: 'rgba(255, 255, 255, 0.15)',
		paddingTop: 12,
		marginBottom: 16,
		backgroundColor: 'transparent',
	},
	breakdownRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		backgroundColor: 'transparent',
	},
	breakdownLabel: {
		color: '#888',
	},
	breakdownPaid: {
		fontWeight: '600',
		color: colors['feedback-success-default'],
	},
	breakdownRemaining: {
		fontWeight: '600',
		color: colors['feedback-warning-dark'],
	},
	formGroup: {
		marginBottom: 15,
	},
	hint: {
		fontSize: 12,
		lineHeight: 16,
		color: '#888',
		marginTop: 6,
	},
	warning: {
		textAlign: 'center',
		color: colors['feedback-warning-dark'],
		marginBottom: 15,
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 10,
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
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontSize: 16,
	},
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
});

export default PayInvoiceModal;
