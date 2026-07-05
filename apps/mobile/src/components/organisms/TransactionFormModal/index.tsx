import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import { useCreateTransactions } from '../../../hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '../../../hooks/api/transactions/useUpdateTransactions';

import { useWallet } from '../../../context/wallet';
import { DateUtils } from '../../../utils/date';
import { MoneyUtils } from '../../../utils/money';

import { TNewTransactionForm } from '../../../types/forms';
import { TTransaction } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface TransactionModalProps {
	visible: boolean;
	onClose: ()=> void;
	transaction?: TTransaction | null;
	suggested_date?: string;
}

const DEFAULT_VALUES: TNewTransactionForm = {
	kind: 'deposit',
	description: '',
	value: '',
	transaction_date: '',
};

export const TransactionFormModal = (props: TransactionModalProps) => {
	const { visible, onClose, transaction, suggested_date } = props;
	const { user_wallet } = useWallet();

	const { mutate: createTransactionMutation, isPending: is_create_transaction_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_transaction_pending } = useUpdateTransactions();
	const [ values, setValues ] = useState<TNewTransactionForm>(DEFAULT_VALUES);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		onClose();
	};

	const handleSave = () => {
		const value = Number(MoneyUtils.unformatMoney(values.value));

		if(transaction){
			updateTransactionMutation({
				body: {
					kind: values.kind,
					description: values.description,
					transaction_date: DateUtils.formatDateToISO(values.transaction_date),
					value,
				},
				id: transaction.id,
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Transação atualizada!',
						text2: 'Sua transação foi atualizada com sucesso',
					});
					handleClose();
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao atualizar transação!',
						text2: 'Ocorreu um erro ao atualizar a transação',
					});
				},
			});

		} else {
			if (!user_wallet.data) {
				Toast.show({
					type: 'error',
					text1: 'Erro ao criar transação! Selecione uma carteira para continuar',
					text2: 'Ocorreu um erro ao criar a transação',
				});
				return;
			}

			createTransactionMutation({
				body: {
					kind: values.kind,
					description: values.description,
					value,
					transaction_date: DateUtils.formatDateToISO(values.transaction_date),
					wallet_id: user_wallet.data?.id,
				},
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Transação criada!',
						text2: 'Sua transação foi criada com sucesso',
					});
					handleClose();
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao criar transação!',
						text2: 'Ocorreu um erro ao criar a transação',
					});
				},
			});
		}
	};

	const is_submit_disabled = (
		is_create_transaction_pending  ||
		is_update_transaction_pending ||
		!values.value ||
		!values.description ||
		!values.kind ||
		!values.transaction_date
	);

	useEffect(() => {
		if (transaction) {
			setValues({
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: DateUtils.formatDate(transaction.transaction_date),
			});
		}
	}, [ transaction ]);

	useEffect(() => {
		if (!transaction) {
			if (suggested_date) {
				setValues(prev => ({ ...prev, transaction_date: suggested_date }));
			} else {
				setValues(prev => ({ ...prev, transaction_date: DateUtils.formatDate(new Date().toISOString()) }));
			}
		}
	}, [ suggested_date, visible, transaction ]);

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={handleClose}
		>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<ThemedText style={styles.title}>{transaction ? `Editar ${ transaction.kind === 'deposit' ? 'Entrada' : 'Saída' }` : 'Nova Transação'}</ThemedText>

					<ThemedView style={styles.formGroup}>
						<SelectInput
							label='Tipo *'
							options={[
								{ label: 'Entrada', value: 'deposit' },
								{ label: 'Saída', value: 'withdraw' } ]}
							value={values.kind}
							onChange={(value) => setValues({ ...values, kind: value as TTransaction['kind'] })}
						/>
					</ThemedView>

					<ThemedView style={styles.formGroup}>
						<ThemedTextInput
							label='Descrição *'
							value={values.description}
							onChangeText={(text) => setValues({ ...values, description: text })}
							placeholder='Digite a descrição'
						/>
					</ThemedView>

					<ThemedView style={styles.formGroupDate}>
						<ThemedView style={styles.fieldContainer}>
							<ThemedTextInput
								label='Valor *'
								value={values.value}
								onChangeText={(text) => {
									const formattedValue = MoneyUtils.formatMoney(text);
									setValues({ ...values, value: formattedValue });
								}}
								placeholder='R$ 0,00'
								keyboardType='numeric'
							/>
						</ThemedView>

						<ThemedView style={styles.fieldContainer}>
							<ThemedTextInput
								label='Data da transação *'
								value={values.transaction_date}
								onChangeText={(text) => {
									const formattedDate = DateUtils.formatDateInput(text);
									setValues({ ...values, transaction_date: formattedDate });
								}}
								placeholder='DD/MM/AAAA'
								maxLength={10}
							/>
						</ThemedView>
					</ThemedView>

					<ThemedView style={styles.buttonContainer}>
						<TouchableOpacity disabled={(is_create_transaction_pending || is_update_transaction_pending )} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
							<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
							<ThemedText style={styles.buttonText}>{(is_create_transaction_pending || is_update_transaction_pending ) ? <Loader /> : 'Salvar'}</ThemedText>
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
	formGroupDate: {
		marginBottom: 15,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	fieldContainer: {
		flex: 1,
	},
	pickerContainer: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 5,
		marginTop: 5,
	},
	picker: {
		height: 50,
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
