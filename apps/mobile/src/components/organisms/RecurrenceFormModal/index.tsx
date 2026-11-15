import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, DateUtils, getApiErrorMessage, MoneyUtils, RECURRENCE_FREQUENCY_OPTIONS, type TRecurrenceFrequency } from '@myfinance/shared';

import { useUpdateRecurrence } from '../../../hooks/api/recurrences/useUpdateRecurrence';

import { toDisplayDate, toISODate } from '../../../utils/datetime';

import { TUpdateRecurrenceBody } from '../../../types/api';
import { TRecurrence } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface RecurrenceFormModalProps {
	visible: boolean;
	onClose: ()=> void;
	recurrence: TRecurrence | null;
}

type TEnds = 'never' | 'date' | 'count';

type TValues = {
	description: string;
	value: string;
	value_varies: boolean;
	frequency: TRecurrenceFrequency;
	interval: string;
	ends: TEnds;
	/* dd/MM/yyyy */
	end_date: string;
	count: string;
};

const ENDS_OPTIONS = [
	{ label: 'Nunca', value: 'never' },
	{ label: 'Numa data', value: 'date' },
	{ label: 'Após N vezes', value: 'count' },
];

const onlyDigits = (text: string) => text.replace(/\D/g, '').slice(0, 3);

const valuesFrom = (recurrence: TRecurrence): TValues => {
	let ends: TEnds = 'never';
	if (recurrence.occurrences_total) ends = 'count';
	else if (recurrence.end_date) ends = 'date';

	return {
		description: recurrence.description,
		value: MoneyUtils.formatMoney(recurrence.value),
		value_varies: recurrence.value_mode === 'estimated',
		frequency: recurrence.frequency,
		interval: String(recurrence.interval || 1),
		ends,
		end_date: recurrence.end_date ? toDisplayDate(recurrence.end_date) : '',
		count: recurrence.occurrences_total ? String(recurrence.occurrences_total) : '',
	};
};

/*
 * Edição da REGRA inteira de uma recorrência (as previstas não editadas acompanham). Em compra parcelada só
 * descrição e valor da parcela — número de parcelas e datas vêm da compra/do banco.
 */
export const RecurrenceFormModal = ({ visible, onClose, recurrence }: RecurrenceFormModalProps) => {
	const { mutate: updateRecurrenceMutation, isPending } = useUpdateRecurrence();
	const [ values, setValues ] = useState<TValues | null>(null);

	useEffect(() => {
		setValues(recurrence ? valuesFrom(recurrence) : null);
	}, [ recurrence ]);

	if (!recurrence || !values) return null;

	const is_installment = recurrence.recurrence_type === 'installment';
	const end_date_iso = toISODate(values.end_date);
	const is_submit_disabled = (
		isPending ||
		!values.description.trim() ||
		!values.value ||
		(!is_installment && !(Number(values.interval) >= 1)) ||
		(!is_installment && values.ends === 'date' && !end_date_iso) ||
		(!is_installment && values.ends === 'count' && !(Number(values.count) >= 1))
	);

	const handleSave = () => {
		const base: TUpdateRecurrenceBody = {
			description: values.description.trim(),
			value: Number(MoneyUtils.unformatMoney(values.value)),
		};
		const body: TUpdateRecurrenceBody = is_installment ? base : {
			...base,
			value_mode: values.value_varies ? 'estimated' : 'fixed',
			frequency: values.frequency,
			interval: Number(values.interval),
			end_date: values.ends === 'date' ? end_date_iso : null,
			occurrences_total: values.ends === 'count' ? Number(values.count) : null,
		};

		updateRecurrenceMutation({
			id: recurrence.id,
			body,
			onSuccess: () => {
				Toast.show({ type: 'success', text1: is_installment ? 'Compra parcelada atualizada!' : 'Recorrência atualizada!' });
				onClose();
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao atualizar!', text2: getApiErrorMessage(error, 'Tente novamente') });
			},
		});
	};

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>{is_installment ? 'Editar compra parcelada' : 'Editar recorrência'}</ThemedText>

						<ScrollView style={styles.scroll} keyboardShouldPersistTaps='handled'>
							<ThemedView style={styles.formGroup}>
								<ThemedTextInput
									label='Descrição *'
									value={values.description}
									onChangeText={(text) => setValues({ ...values, description: text })}
									placeholder='Ex.: Netflix'
								/>
							</ThemedView>

							<ThemedView style={styles.formGroup}>
								<ThemedTextInput
									label={is_installment ? 'Valor da parcela *' : 'Valor *'}
									value={values.value}
									onChangeText={(text) => setValues({ ...values, value: MoneyUtils.formatMoney(text) })}
									placeholder='R$ 0,00'
									keyboardType='numeric'
								/>
							</ThemedView>

							{!is_installment && (
								<>
									<TouchableOpacity
										style={styles.toggleRow}
										onPress={() => setValues({ ...values, value_varies: !values.value_varies })}
										activeOpacity={0.7}
									>
										<Icon
											name={values.value_varies ? 'check-box' : 'check-box-outline-blank'}
											size={22}
											color={colors['brand-secondary']}
										/>
										<ThemedText style={styles.toggleText}>
											Valor varia <ThemedText style={styles.hint}>— as próximas seguem o último valor real</ThemedText>
										</ThemedText>
									</TouchableOpacity>

									<ThemedView style={[ styles.formGroup, styles.row ]}>
										<ThemedView style={styles.col}>
											<SelectInput
												label='Frequência'
												options={RECURRENCE_FREQUENCY_OPTIONS}
												value={values.frequency}
												onChange={(frequency) => frequency && setValues({ ...values, frequency: frequency as TRecurrenceFrequency })}
											/>
										</ThemedView>
										<ThemedView style={styles.col}>
											<ThemedTextInput
												label='A cada'
												value={values.interval}
												onChangeText={(text) => setValues({ ...values, interval: onlyDigits(text) })}
												placeholder='1'
												keyboardType='numeric'
											/>
										</ThemedView>
									</ThemedView>

									<ThemedView style={styles.formGroup}>
										<SelectInput
											label='Termina'
											options={ENDS_OPTIONS}
											value={values.ends}
											onChange={(ends) => ends && setValues({ ...values, ends: ends as TEnds })}
										/>
									</ThemedView>

									{values.ends === 'date' && (
										<ThemedView style={styles.formGroup}>
											<ThemedTextInput
												label='Última data *'
												value={values.end_date}
												onChangeText={(text) => setValues({ ...values, end_date: DateUtils.formatDateInput(text) })}
												placeholder='DD/MM/AAAA'
												keyboardType='numeric'
												maxLength={10}
											/>
										</ThemedView>
									)}

									{values.ends === 'count' && (
										<ThemedView style={styles.formGroup}>
											<ThemedTextInput
												label='Quantas vezes (no total) *'
												value={values.count}
												onChangeText={(text) => setValues({ ...values, count: onlyDigits(text) })}
												placeholder='Ex.: 12'
												keyboardType='numeric'
											/>
										</ThemedView>
									)}
								</>
							)}

							<ThemedText style={styles.hint}>
								Vale para a regra inteira: as previstas que você não editou acompanham. As já lançadas ficam como estão.
							</ThemedText>
						</ScrollView>

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
		maxHeight: '88%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
	},
	scroll: {
		flexGrow: 0,
	},
	title: {
		fontSize: 22,
		marginBottom: 20,
		textAlign: 'center',
	},
	formGroup: {
		marginBottom: 15,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
	},
	col: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	toggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 8,
		marginBottom: 8,
	},
	toggleText: {
		flex: 1,
	},
	hint: {
		color: '#888',
		fontSize: 12,
		lineHeight: 16,
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

export default RecurrenceFormModal;
