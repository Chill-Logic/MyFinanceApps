import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { useCreateWallets } from '../../../hooks/api/wallets/useCreateWallets';
import { useUpdateWallets } from '../../../hooks/api/wallets/useUpdateWallets';

import { TNewWalletForm	 } from '../../../types/forms';
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

const DEFAULT_VALUES: TNewWalletForm = {
	name: '',
};

export const WalletFormModal = (props: WalletModalProps) => {
	const { visible, onClose, wallet, onSuccess } = props;

	const { mutate: createWalletMutation, isPending: is_create_wallet_pending } = useCreateWallets();
	const { mutate: updateWalletMutation, isPending: is_update_wallet_pending } = useUpdateWallets();
	const [ values, setValues ] = useState<TNewWalletForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {
		if(wallet){
			updateWalletMutation({
				body: {
					name: values.name,
				},
				id: wallet.id,
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Carteira atualizada!',
						text2: 'Sua carteira foi atualizada com sucesso',
					});
					handleClose();
					onSuccess?.();
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao atualizar carteira!',
						text2: 'Ocorreu um erro ao atualizar a carteira',
					});
				},
			});

		} else {
			createWalletMutation({
				body: {
					name: values.name,
				},
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Carteira criada!',
						text2: 'Sua carteira foi criada com sucesso',
					});
					handleClose();
					onSuccess?.();
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao criar carteira!',
						text2: 'Ocorreu um erro ao criar a carteira',
					});
				},
			});
		}
	};

	const is_submit_disabled = (
		is_create_wallet_pending  ||
		is_update_wallet_pending ||
		!values.name
	);

	useEffect(() => {
		if (wallet) {
			setValues({
				name: wallet.name,
			});
		}
	}, [ wallet ]);

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={handleClose}
		>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<ThemedText style={styles.title}>{wallet ? `Editar ${ wallet.name }` : 'Nova Carteira'}</ThemedText>

					<ThemedView style={styles.formGroup}>
						<ThemedTextInput
							label='Nome *'
							value={values.name}
							onChangeText={(text) => setValues({ ...values, name: text })}
							placeholder='Digite o nome da carteira'
						/>
					</ThemedView>

					<ThemedView style={styles.buttonContainer}>
						<TouchableOpacity disabled={(is_create_wallet_pending || is_update_wallet_pending )} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
							<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
							<ThemedText style={styles.buttonText}>{(is_create_wallet_pending || is_update_wallet_pending ) ? <Loader /> : 'Salvar'}</ThemedText>
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
