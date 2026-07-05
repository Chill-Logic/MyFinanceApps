import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { useCreateWalletInvites } from '../../../hooks/api/user-wallets/useCreateWalletInvites';

import { useWallet } from '../../../context/wallet';

import { TNewWalletInviteForm } from '../../../types/forms';
import { TWallet } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface WalletModalProps {
	visible: boolean;
	onClose: ()=> void;
	wallet?: TWallet | null;
	onSuccess?: ()=> void;
}

const DEFAULT_VALUES: TNewWalletInviteForm = {
	user_email: '',
};

export const WalletInviteFormModal = (props: WalletModalProps) => {
	const { visible, onClose, onSuccess } = props;
	const { user_wallet } = useWallet();

	const { mutate: createWalletInviteMutation, isPending: is_create_wallet_invite_pending } = useCreateWalletInvites();
	const [ values, setValues ] = useState<TNewWalletInviteForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {

		if(user_wallet.data?.id){
			createWalletInviteMutation({
				body: {
					user_email: values.user_email,
					wallet_id: user_wallet.data?.id,
				},
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Convite enviado!',
						text2: 'Seu convite foi enviado com sucesso',
					});
					handleClose();
					onSuccess?.();
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao enviar convite!',
						text2: 'Ocorreu um erro ao enviar o convite',
					});
				},
			});
		}
	};

	const is_submit_disabled = (
		is_create_wallet_invite_pending ||
		!values.user_email
	);

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={handleClose}
		>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<ThemedText style={styles.title}>Convite de acesso</ThemedText>
					<ThemedView style={styles.formGroup}>
						<ThemedTextInput
							label='Email *'
							value={values.user_email}
							onChangeText={(text) => setValues({ ...values, user_email: text })}
							placeholder='Digite o email do usuário'
							keyboardType='email-address'
							autoCapitalize='none'
						/>
					</ThemedView>

					<ThemedView style={styles.buttonContainer}>
						<TouchableOpacity disabled={is_create_wallet_invite_pending} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
							<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
							<ThemedText style={styles.buttonText}>{(is_create_wallet_invite_pending) ? <Loader /> : 'Salvar'}</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</ThemedView>
			</ThemedView>
		</Modal>
	);
};

const styles = StyleSheet.create({
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
		backgroundColor: '#A328D6',
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
