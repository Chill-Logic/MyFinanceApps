import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useUpdateCurrentUser } from '../../../hooks/api/user/useUpdateCurrentUser';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface IProps {
	visible: boolean;
	onClose: ()=> void;
}

const INITIAL_VALUES = { current_password: '', password: '', password_confirmation: '' };

/**
 * Modal de troca de senha — subitem "Atualizar senha" das Configurações. Exige a senha atual
 * (confirmação de identidade no backend) + nova + confirmação; valida a confirmação no client.
 */
export const AccountPasswordFormModal = ({ visible, onClose }: IProps) => {
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState(INITIAL_VALUES);

	useEffect(() => {
		if (visible) setValues(INITIAL_VALUES);
	}, [ visible ]);

	const is_submit_disabled = isPending || !values.current_password || !values.password || !values.password_confirmation;

	const handleSave = () => {
		if (values.password !== values.password_confirmation) {
			Toast.show({ type: 'error', text1: 'Erro', text2: 'As senhas não coincidem' });
			return;
		}

		updateUserMutation({
			body: values,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Senha atualizada!' });
				onClose();
			},
			onError: (error) => {
				Toast.show({
					type: 'error',
					text1: 'Erro ao atualizar senha',
					text2: getApiErrorMessage(error, 'Verifique a senha atual e tente novamente'),
				});
			},
		});
	};

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>Atualizar senha</ThemedText>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Senha atual *'
								value={values.current_password}
								onChangeText={(text) => setValues({ ...values, current_password: text })}
								placeholder='Sua senha atual'
								secureTextEntry
								autoCapitalize='none'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Nova senha *'
								value={values.password}
								onChangeText={(text) => setValues({ ...values, password: text })}
								placeholder='Nova senha'
								secureTextEntry
								autoCapitalize='none'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Confirmar nova senha *'
								value={values.password_confirmation}
								onChangeText={(text) => setValues({ ...values, password_confirmation: text })}
								placeholder='Repita a nova senha'
								secureTextEntry
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
