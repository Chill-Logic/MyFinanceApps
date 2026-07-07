import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors } from '@myfinance/shared';

import { useCreateTransactions } from '../../../hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '../../../hooks/api/transactions/useUpdateTransactions';

import { useTheme } from '../../../context/theme';
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

/**
 * Conversão puramente textual (sem passar por Date/toISOString) de propósito — evitar
 * qualquer risco de o fuso horário deslocar o dia, já que aqui só interessa o valor
 * exibido/selecionado no calendário, não um instante no tempo.
 */
const toISODate = (display_date: string) => {
	const [ day, month, year ] = display_date.split('/');
	if (!day || !month || !year) return '';
	return `${ year }-${ month }-${ day }`;
};

const toDisplayDate = (iso_date: string) => {
	const [ year, month, day ] = iso_date.split('-');
	return `${ day }/${ month }/${ year }`;
};

export const TransactionFormModal = (props: TransactionModalProps) => {
	const { visible, onClose, transaction, suggested_date } = props;
	const { theme } = useTheme();
	const { user_wallet } = useWallet();

	const { mutate: createTransactionMutation, isPending: is_create_transaction_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_transaction_pending } = useUpdateTransactions();
	const [ values, setValues ] = useState<TNewTransactionForm>(DEFAULT_VALUES);
	const [ is_calendar_visible, setIsCalendarVisible ] = useState(false);

	const handleClose = () => {
		setValues(DEFAULT_VALUES);
		setIsCalendarVisible(false);
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
			onRequestClose={is_calendar_visible ? () => setIsCalendarVisible(false) : handleClose}
		>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					{is_calendar_visible ? (
						<>
							<ThemedView style={styles.calendarHeader}>
								<TouchableOpacity onPress={() => setIsCalendarVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
									<Icon name='arrow-back' size={22} color={theme.colors.text} />
								</TouchableOpacity>
								<ThemedText style={styles.calendarHeaderTitle}>Selecionar data</ThemedText>
								<ThemedView style={styles.calendarHeaderSpacer} />
							</ThemedView>

							<Calendar
								current={toISODate(values.transaction_date) || undefined}
								onDayPress={(day: DateData) => {
									setValues((prev) => ({ ...prev, transaction_date: toDisplayDate(day.dateString) }));
									setIsCalendarVisible(false);
								}}
								markedDates={values.transaction_date ? {
									[toISODate(values.transaction_date)]: { selected: true, selectedColor: colors['brand-secondary'] },
								} : undefined}
								theme={{
									calendarBackground: theme.colors.background,
									dayTextColor: theme.colors.text,
									monthTextColor: theme.colors.text,
									textDisabledColor: theme.colors.placeholder,
									arrowColor: theme.colors.text,
									todayTextColor: colors['brand-secondary'],
									selectedDayBackgroundColor: colors['brand-secondary'],
									selectedDayTextColor: '#fff',
								}}
							/>
						</>
					) : (
						<>
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
									<ThemedText style={styles.dateTriggerLabel}>Data da transação *</ThemedText>
									<TouchableOpacity
										style={[ styles.dateTrigger, { borderColor: theme.colors.border } ]}
										onPress={() => setIsCalendarVisible(true)}
										activeOpacity={0.7}
									>
										<ThemedText
											numberOfLines={1}
											style={[ styles.dateTriggerText, !values.transaction_date && { color: theme.colors.placeholder } ]}
										>
											{values.transaction_date || 'Selecionar'}
										</ThemedText>
										<Icon name='calendar-today' size={16} color={theme.colors.placeholder} />
									</TouchableOpacity>
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
						</>
					)}
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
	calendarHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	calendarHeaderTitle: {
		fontSize: 18,
		fontWeight: '600',
	},
	calendarHeaderSpacer: {
		width: 22,
	},
	dateTriggerLabel: {
		marginBottom: 5,
	},
	dateTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: 50,
		borderWidth: 1,
		borderRadius: 5,
		paddingHorizontal: 10,
		marginTop: 5,
		gap: 8,
	},
	dateTriggerText: {
		flex: 1,
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
