import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { usePayInvoice } from '../../../hooks/api/credit-balances/usePayInvoice';

import { useWallet } from '../../../context/wallet';

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

	const value_cents = Number(MoneyUtils.unformatMoney(value));

	const handleClose = () => {
		setAccountId('');
		setValue('');
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

		payInvoiceMutation({
			body: { account_id, value: value_cents, ...(date ? { date } : {}) },
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

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
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
		padding: 20,
		borderRadius: 10,
		elevation: 5,
	},
	title: {
		fontSize: 24,
		marginBottom: 8,
		textAlign: 'center',
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
