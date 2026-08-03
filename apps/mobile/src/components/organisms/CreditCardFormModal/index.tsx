import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useCreateCreditCard } from '../../../hooks/api/credit-cards/useCreateCreditCard';
import { useUpdateCreditCard } from '../../../hooks/api/credit-cards/useUpdateCreditCard';

import { TCreditCardForm } from '../../../types/forms';
import { TCreditCard } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface CreditCardFormModalProps {
	visible: boolean;
	onClose: ()=> void;
	creditBalanceId?: string;
	card?: TCreditCard | null;
	onSuccess?: ()=> void;
}

const DEFAULT_VALUES: TCreditCardForm = {
	name: '',
	last_digits: '',
};

export const CreditCardFormModal = (props: CreditCardFormModalProps) => {
	const { visible, onClose, creditBalanceId, card, onSuccess } = props;

	const { mutate: createCardMutation, isPending: is_create_pending } = useCreateCreditCard();
	const { mutate: updateCardMutation, isPending: is_update_pending } = useUpdateCreditCard();
	const [ values, setValues ] = useState<TCreditCardForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {
		const body = { name: values.name, last_digits: values.last_digits || undefined };

		if (card) {
			updateCardMutation({
				body,
				id: card.id,
				onSuccess: () => {
					Toast.show({ type: 'success', text1: 'Cartão atualizado!' });
					handleClose();
					onSuccess?.();
				},
				onError: (error) => {
					Toast.show({ type: 'error', text1: 'Erro ao atualizar cartão!', text2: getApiErrorMessage(error, 'Tente novamente') });
				},
			});
			return;
		}

		if (!creditBalanceId) {
			Toast.show({ type: 'error', text1: 'Crédito não identificado' });
			return;
		}

		createCardMutation({
			body,
			credit_balance_id: creditBalanceId,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: 'Cartão criado!' });
				handleClose();
				onSuccess?.();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao criar cartão!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	const is_submit_disabled = is_create_pending || is_update_pending || !values.name;

	useEffect(() => {
		if (card) {
			setValues({ name: card.name, last_digits: card.last_digits || '' });
		}
	}, [ card ]);

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>{card ? 'Editar cartão' : 'Novo cartão'}</ThemedText>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Nome *'
								value={values.name}
								onChangeText={(text) => setValues({ ...values, name: text })}
								placeholder='Ex.: Físico, Virtual, Adicional'
							/>
						</ThemedView>

						<ThemedView style={styles.formGroup}>
							<ThemedTextInput
								label='Últimos dígitos (opcional)'
								value={values.last_digits}
								onChangeText={(text) => setValues({ ...values, last_digits: text.replace(/\D/g, '').slice(0, 4) })}
								placeholder='1234'
								keyboardType='numeric'
								maxLength={4}
							/>
						</ThemedView>

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

export default CreditCardFormModal;
