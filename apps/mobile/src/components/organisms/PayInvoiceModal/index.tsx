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
import { ThemedView } from '../../atoms/ThemedView';

interface PayInvoiceModalProps {
	visible: boolean;
	onClose: ()=> void;
	creditBalance: TCreditBalance;
	invoice?: TCurrentInvoice;
	/* Data do ciclo navegado (YYYY-MM-DD); ausente = ciclo atual (backend usa hoje). */
	referenceDate?: string;
}

export const PayInvoiceModal = (props: PayInvoiceModalProps) => {
	const { visible, onClose, creditBalance, invoice, referenceDate } = props;
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data: accounts_data } = useIndexAccounts({
		enabled: visible && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: payInvoiceMutation, isPending } = usePayInvoice();

	const [ account_id, setAccountId ] = useState('');

	const accounts = useMemo(() => accounts_data?.data || [], [ accounts_data ]);

	/* Pré-seleciona a primeira conta quando o modal abre e ainda não há escolha. */
	useEffect(() => {
		if (visible && !account_id && accounts.length > 0) {
			setAccountId(accounts[0].id);
		}
	}, [ visible, account_id, accounts ]);

	const handleClose = () => {
		setAccountId('');
		onClose();
	};

	const handlePay = () => {
		if (!account_id) {
			Toast.show({ type: 'error', text1: 'Escolha a conta pagadora' });
			return;
		}

		payInvoiceMutation({
			body: { account_id, date: referenceDate },
			id: creditBalance.id,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Fatura paga!' });
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

						<ThemedText style={styles.amount}>{MoneyUtils.formatMoney(invoice?.amount ?? 0)}</ThemedText>
						<ThemedText style={styles.subtitle}>{creditBalance.name}</ThemedText>

						{has_accounts ? (
							<ThemedView style={styles.formGroup}>
								<SelectInput
									label='Conta pagadora *'
									options={accounts.map((account) => ({ label: account.name, value: account.id }))}
									value={account_id}
									onChange={setAccountId}
								/>
							</ThemedView>
						) : (
							<ThemedText style={styles.warning}>Você precisa de uma conta para pagar a fatura.</ThemedText>
						)}

						<ThemedView style={styles.buttonContainer}>
							<TouchableOpacity disabled={isPending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
								<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity
								disabled={isPending || !has_accounts}
								style={[ styles.button, (isPending || !has_accounts) ? styles.saveButtonDisabled : styles.saveButton ]}
								onPress={handlePay}
							>
								<ThemedText style={styles.buttonText}>{isPending ? <Loader /> : 'Pagar'}</ThemedText>
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
	formGroup: {
		marginBottom: 15,
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
