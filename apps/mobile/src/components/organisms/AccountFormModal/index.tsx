import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useCreateAccount } from '../../../hooks/api/accounts/useCreateAccount';
import { useUpdateAccount } from '../../../hooks/api/accounts/useUpdateAccount';

import { useWallet } from '../../../context/wallet';

import { TAccountForm } from '../../../types/forms';
import { TAccount, TAccountKind } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface AccountFormModalProps {
	visible: boolean;
	onClose: ()=> void;
	account?: TAccount | null;
	onSuccess?: ()=> void;
}

const DEFAULT_VALUES: TAccountForm = {
	name: '',
	kind: 'checking',
	initial_balance: '',
};

const KIND_OPTIONS = [
	{ label: 'Conta corrente', value: 'checking' },
	{ label: 'Poupança', value: 'savings' },
	{ label: 'Dinheiro', value: 'cash' },
];

export const AccountFormModal = (props: AccountFormModalProps) => {
	const { visible, onClose, account, onSuccess } = props;
	const { user_wallet } = useWallet();

	const { mutate: createAccountMutation, isPending: is_create_pending } = useCreateAccount();
	const { mutate: updateAccountMutation, isPending: is_update_pending } = useUpdateAccount();
	const [ values, setValues ] = useState<TAccountForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {
		/* Update só mexe em nome/tipo. O saldo inicial existe só na criação (vira uma transação no backend). */
		if (account) {
			updateAccountMutation({
				body: { name: values.name, kind: values.kind },
				id: account.id,
				onSuccess: () => {
					Toast.show({ type: 'success', text1: 'Conta atualizada!' });
					handleClose();
					onSuccess?.();
				},
				onError: (error) => {
					Toast.show({ type: 'error', text1: 'Erro ao atualizar conta!', text2: getApiErrorMessage(error, 'Tente novamente') });
				},
			});
			return;
		}

		if (!user_wallet.data) {
			Toast.show({ type: 'error', text1: 'Selecione uma carteira para continuar' });
			return;
		}

		createAccountMutation({
			body: { name: values.name, kind: values.kind, initial_balance: Number(MoneyUtils.unformatMoney(values.initial_balance)) },
			wallet_id: user_wallet.data.id,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Conta criada!' });
				handleClose();
				onSuccess?.();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao criar conta!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	const is_submit_disabled = is_create_pending || is_update_pending || !values.name;

	useEffect(() => {
		if (account) {
			setValues({ name: account.name, kind: account.kind, initial_balance: '' });
		}
	}, [ account ]);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>{account ? 'Editar conta' : 'Nova conta'}</ThemedText>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Nome *'
								value={values.name}
								onChangeText={(text) => setValues({ ...values, name: text })}
								placeholder='Ex.: Nubank, Carteira'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<SelectInput
								label='Tipo *'
								options={KIND_OPTIONS}
								value={values.kind}
								onChange={(value) => setValues({ ...values, kind: value as TAccountKind })}
							/>
						</ThemedView>

						{/* Saldo inicial só na criação — no backend vira uma transação "Saldo inicial" efetivada */}
						{!account && (
							<ThemedView style={styles.formGroup}>
								<ThemedTextInput
									label='Saldo inicial'
									value={values.initial_balance}
									onChangeText={(text) => setValues({ ...values, initial_balance: MoneyUtils.formatMoney(text) })}
									placeholder='R$ 0,00'
									keyboardType='numeric'
								/>
							</ThemedView>
						)}

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

export default AccountFormModal;
