import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useCreateCreditBalance } from '../../../hooks/api/credit-balances/useCreateCreditBalance';
import { useUpdateCreditBalance } from '../../../hooks/api/credit-balances/useUpdateCreditBalance';

import { useWallet } from '../../../context/wallet';

import { TCreditBalanceForm } from '../../../types/forms';
import { TCreditBalance } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface CreditBalanceFormModalProps {
	visible: boolean;
	onClose: ()=> void;
	creditBalance?: TCreditBalance | null;
	onSuccess?: ()=> void;
}

const DEFAULT_VALUES: TCreditBalanceForm = {
	name: '',
	credit_limit: '',
	closing_day: '',
	due_day: '',
};

/* Mantém o dia entre 1 e 31 (só dígitos). String vazia é permitida enquanto o usuário digita. */
const clampDay = (text: string): string => {
	const digits = text.replace(/\D/g, '');
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

export const CreditBalanceFormModal = (props: CreditBalanceFormModalProps) => {
	const { visible, onClose, creditBalance, onSuccess } = props;
	const { user_wallet } = useWallet();

	const { mutate: createBalanceMutation, isPending: is_create_pending } = useCreateCreditBalance();
	const { mutate: updateBalanceMutation, isPending: is_update_pending } = useUpdateCreditBalance();
	const [ values, setValues ] = useState<TCreditBalanceForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {
		const body = {
			name: values.name,
			credit_limit: Number(MoneyUtils.unformatMoney(values.credit_limit)),
			closing_day: Number(values.closing_day),
			due_day: Number(values.due_day),
		};

		if (creditBalance) {
			updateBalanceMutation({
				body,
				id: creditBalance.id,
				onSuccess: () => {
					Toast.show({ type: 'success', text1: 'Crédito atualizado!' });
					handleClose();
					onSuccess?.();
				},
				onError: (error) => {
					Toast.show({ type: 'error', text1: 'Erro ao atualizar crédito!', text2: getApiErrorMessage(error, 'Tente novamente') });
				},
			});
			return;
		}

		if (!user_wallet.data) {
			Toast.show({ type: 'error', text1: 'Selecione uma carteira para continuar' });
			return;
		}

		createBalanceMutation({
			body,
			wallet_id: user_wallet.data.id,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Crédito criado!' });
				handleClose();
				onSuccess?.();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao criar crédito!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	const is_submit_disabled = (
		is_create_pending ||
		is_update_pending ||
		!values.name ||
		!values.credit_limit ||
		!values.closing_day ||
		!values.due_day
	);

	useEffect(() => {
		if (creditBalance) {
			setValues({
				name: creditBalance.name,
				credit_limit: MoneyUtils.formatMoney(creditBalance.credit_limit),
				closing_day: String(creditBalance.closing_day),
				due_day: String(creditBalance.due_day),
			});
		}
	}, [ creditBalance ]);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>{creditBalance ? 'Editar crédito' : 'Novo crédito'}</ThemedText>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Nome *'
								value={values.name}
								onChangeText={(text) => setValues({ ...values, name: text })}
								placeholder='Ex.: Nubank, Inter'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Limite *'
								value={values.credit_limit}
								onChangeText={(text) => setValues({ ...values, credit_limit: MoneyUtils.formatMoney(text) })}
								placeholder='R$ 0,00'
								keyboardType='numeric'
							/>
						</ThemedView>

						<View style={styles.row}>
							<View style={styles.rowItem}>
								<ThemedTextInput
									label='Fechamento *'
									value={values.closing_day}
									onChangeText={(text) => setValues({ ...values, closing_day: clampDay(text) })}
									placeholder='Dia (1–31)'
									keyboardType='numeric'
									maxLength={2}
								/>
							</View>
							<View style={styles.rowItem}>
								<ThemedTextInput
									label='Vencimento *'
									value={values.due_day}
									onChangeText={(text) => setValues({ ...values, due_day: clampDay(text) })}
									placeholder='Dia (1–31)'
									keyboardType='numeric'
									maxLength={2}
								/>
							</View>
						</View>

						<ThemedView style={styles.buttonContainer}>
							<TouchableOpacity disabled={is_create_pending || is_update_pending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
								<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
								<ThemedText style={styles.buttonText}>{(is_create_pending || is_update_pending) ? <Loader /> : 'Salvar'}</ThemedText>
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
		marginBottom: 20,
		textAlign: 'center',
	},
	formGroup: {
		marginBottom: 15,
	},
	row: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 15,
	},
	rowItem: {
		flex: 1,
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
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontSize: 16,
	},
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
});

export default CreditBalanceFormModal;
