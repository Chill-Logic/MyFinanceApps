import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useUpdateCurrentUser } from '../../../hooks/api/user/useUpdateCurrentUser';

import { useCurrentUserContext } from '../../../context/current_user';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface IProps {
	visible: boolean;
	onClose: ()=> void;
}

/**
 * Modal de dados pessoais (nome/e-mail) — subitem "Informações pessoais" das Configurações. Só
 * perfil; a troca de senha vive no AccountPasswordFormModal. Atualiza o current_user no contexto.
 */
export const AccountInfoFormModal = ({ visible, onClose }: IProps) => {
	const { current_user, setCurrentUser } = useCurrentUserContext();
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState({ name: '', email: '' });

	useEffect(() => {
		if (visible && current_user.data) {
			setValues({ name: current_user.data.name, email: current_user.data.email });
		}
	}, [ visible, current_user.data ]);

	const is_unchanged = current_user.data?.name === values.name && current_user.data?.email === values.email;
	const is_submit_disabled = isPending || is_unchanged || !values.name || !values.email;

	const handleSave = () => {
		updateUserMutation({
			body: { name: values.name, email: values.email },
			onSuccess: (user) => {
				setCurrentUser({ data: user });
				Toast.show({ type: 'success', text1: 'Dados atualizados!' });
				onClose();
			},
			onError: (error) => {
				Toast.show({
					type: 'error',
					text1: 'Erro ao atualizar dados',
					text2: getApiErrorMessage(error, 'Tente novamente'),
				});
			},
		});
	};

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>Informações pessoais</ThemedText>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Nome *'
								value={values.name}
								onChangeText={(text) => setValues({ ...values, name: text })}
								placeholder='Seu nome'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='E-mail *'
								value={values.email}
								onChangeText={(text) => setValues({ ...values, email: text })}
								placeholder='seu@email.com'
								keyboardType='email-address'
								autoCapitalize='none'
							/>
						</ThemedView>

						<ThemedView style={styles.buttonContainer}>
							<TouchableOpacity disabled={isPending} style={[ styles.button, styles.cancelButton ]} onPress={onClose}>
								<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
								<ThemedText style={styles.buttonText}>{isPending ? <Loader /> : 'Salvar'}</ThemedText>
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
	saveButtonDisabled: {
		backgroundColor: '#ccc',
	},
	buttonText: {
		color: 'white',
		textAlign: 'center',
		fontSize: 16,
	},
});
