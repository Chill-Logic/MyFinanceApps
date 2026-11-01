import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import {
	BANK_IMPORT_MODE_OPTIONS,
	BANK_IMPORT_RETENTION_HELP,
	BankConnectionUtils,
	colors,
	DateUtils,
	getApiErrorMessage,
} from '@myfinance/shared';

import { useCreateBankImport } from '../../../hooks/api/bank-imports/useCreateBankImport';

import { useTheme } from '../../../context/theme';
import { toDisplayDate, toISODate } from '../../../utils/datetime';

import { TBankAccountLink, TBankImportMode } from '../../../types/models';

import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface BankImportModalProps {
	visible: boolean;
	onClose: ()=> void;
	link: TBankAccountLink | null;
}

const isCompleteDate = (display_date: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(display_date);

export const BankImportModal = ({ visible, onClose, link }: BankImportModalProps) => {
	const { theme } = useTheme();
	const { mutate: createImportMutation, isPending } = useCreateBankImport();

	const [ date_from, setDateFrom ] = useState('');
	const [ date_to, setDateTo ] = useState('');
	const [ mode, setMode ] = useState<TBankImportMode>('preserve');
	const [ adjust_balance, setAdjustBalance ] = useState(false);

	useEffect(() => {
		if (!visible) return;

		const period = BankConnectionUtils.defaultImportPeriod();
		setDateFrom(toDisplayDate(period.date_from));
		setDateTo(toDisplayDate(period.date_to));
		setMode('preserve');
		setAdjustBalance(false);
	}, [ visible ]);

	const is_bank = link?.external_type === 'BANK';
	const iso_from = isCompleteDate(date_from) ? toISODate(date_from) : '';
	const iso_to = isCompleteDate(date_to) ? toISODate(date_to) : '';
	const is_period_valid = Boolean(iso_from) && Boolean(iso_to) && iso_from <= iso_to;

	const handleSubmit = () => {
		if (!link || !is_period_valid) return;

		createImportMutation({
			body: {
				bank_account_link_id: link.id,
				mode,
				date_from: iso_from,
				date_to: iso_to,
				adjust_balance: is_bank && adjust_balance,
			},
			onSuccess: (bank_import) => {
				Toast.show({ type: 'success', text1: 'Importação concluída', text2: BankConnectionUtils.importSummaryMessage([ bank_import ]) });
				onClose();
			},
			onError: (error) => Toast.show({
				type: 'error',
				text1: 'Erro ao importar o período',
				text2: getApiErrorMessage(error, 'Tente novamente'),
			}),
		});
	};

	return (
		<Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoider}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
							<ThemedText style={styles.title} numberOfLines={2}>Importar período</ThemedText>
							{link?.name ? <ThemedText style={styles.subtle}>{link.name}</ThemedText> : null}
							<ThemedText style={styles.subtle}>{BANK_IMPORT_RETENTION_HELP}</ThemedText>

							<View style={styles.dateRow}>
								<View style={styles.dateCol}>
									<ThemedTextInput
										label='De'
										value={date_from}
										onChangeText={(text) => setDateFrom(DateUtils.formatDateInput(text))}
										placeholder='dd/mm/aaaa'
										keyboardType='number-pad'
										maxLength={10}
									/>
								</View>
								<View style={styles.dateCol}>
									<ThemedTextInput
										label='Até'
										value={date_to}
										onChangeText={(text) => setDateTo(DateUtils.formatDateInput(text))}
										placeholder='dd/mm/aaaa'
										keyboardType='number-pad'
										maxLength={10}
									/>
								</View>
							</View>
							{!is_period_valid && <ThemedText style={styles.error}>Informe um período válido (de ≤ até).</ThemedText>}

							<ThemedText style={styles.sectionLabel}>Modo</ThemedText>
							{BANK_IMPORT_MODE_OPTIONS.map((option) => {
								const active = option.value === mode;
								const accent = option.warning ? colors['feedback-warning-default'] : colors['brand-secondary'];

								return (
									<TouchableOpacity
										key={option.value}
										style={[
											styles.option,
											{ borderColor: active ? accent : theme.colors.border },
											option.warning && active && { backgroundColor: 'rgba(239, 176, 3, 0.12)' },
										]}
										onPress={() => setMode(option.value)}
										accessibilityRole='radio'
										accessibilityState={{ checked: active }}
									>
										<Icon name={active ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={active ? accent : theme.colors.placeholder} />
										<View style={styles.optionInfo}>
											<ThemedText style={[ styles.optionLabel, option.warning && { color: colors['feedback-warning-default'] } ]}>
												{option.warning ? '⚠ ' : ''}{option.label}
											</ThemedText>
											<ThemedText style={styles.subtle}>{option.description}</ThemedText>
										</View>
									</TouchableOpacity>
								);
							})}

							{is_bank && (
								<TouchableOpacity
									style={styles.checkboxRow}
									onPress={() => setAdjustBalance((current) => !current)}
									accessibilityRole='checkbox'
									accessibilityState={{ checked: adjust_balance }}
								>
									<Icon
										name={adjust_balance ? 'check-box' : 'check-box-outline-blank'}
										size={22}
										color={adjust_balance ? colors['brand-secondary'] : theme.colors.placeholder}
									/>
									<ThemedText style={styles.checkboxLabel}>Ajustar o saldo para bater com o banco</ThemedText>
								</TouchableOpacity>
							)}

							<View style={styles.buttonContainer}>
								<TouchableOpacity style={[ styles.button, styles.cancelButton ]} onPress={onClose} disabled={isPending}>
									<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
								</TouchableOpacity>
								<TouchableOpacity
									style={[ styles.button, styles.saveButton, (!is_period_valid || isPending) && styles.disabled ]}
									onPress={handleSubmit}
									disabled={!is_period_valid || isPending}
								>
									{isPending ? <ActivityIndicator color='#fff' /> : <ThemedText style={styles.buttonText}>Importar</ThemedText>}
								</TouchableOpacity>
							</View>
						</ScrollView>
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
		maxHeight: '90%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
	},
	title: {
		fontSize: 22,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	error: {
		color: colors['feedback-danger-default'],
		fontSize: 12,
		marginTop: 4,
	},
	dateRow: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 12,
	},
	dateCol: {
		flex: 1,
	},
	sectionLabel: {
		fontWeight: '600',
		marginTop: 16,
		marginBottom: 8,
	},
	option: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 10,
		borderWidth: 1,
		borderRadius: 6,
		paddingVertical: 8,
		paddingHorizontal: 10,
		marginBottom: 8,
	},
	optionInfo: {
		flex: 1,
	},
	optionLabel: {
		fontWeight: '600',
	},
	checkboxRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 8,
	},
	checkboxLabel: {
		flex: 1,
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 16,
	},
	button: {
		flex: 1,
		padding: 15,
		borderRadius: 5,
		marginHorizontal: 5,
		alignItems: 'center',
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
	disabled: {
		opacity: 0.6,
	},
});

export default BankImportModal;
