import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useCreateCreditBalance } from '../../../hooks/api/credit-balances/useCreateCreditBalance';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';
import { useCreateCreditCard } from '../../../hooks/api/credit-cards/useCreateCreditCard';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { Loader } from '../../atoms/Loader';
import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

interface NewCardModalProps {
	visible: boolean;
	onClose: ()=> void;
	/* Ao abrir a partir de um crédito existente: já marca "compartilhar" e pré-seleciona esse limite. */
	defaultShareCreditBalanceId?: string;
}

/* Mantém o dia entre 1 e 31 (só dígitos). */
const clampDay = (text: string): string => {
	const digits = text.replace(/\D/g, '');
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

/*
 * Modal unificado "Novo Cartão" — some com a distinção linha-de-crédito vs cartão pro usuário
 * (mesma lógica do NewCardDialog do web):
 * - Sem "Compartilhar limite": cria uma linha de crédito nova (nome = o que o usuário digitou) e, no
 *   sucesso, um cartão "PRINCIPAL" dentro dela.
 * - Com "Compartilhar limite": cria só o cartão (nome = o do usuário) dentro do limite escolhido.
 */
export const NewCardModal = ({ visible, onClose, defaultShareCreditBalanceId }: NewCardModalProps) => {
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data: credit_balances_data } = useIndexCreditBalances({
		enabled: visible && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const credit_balances = credit_balances_data?.data || [];
	const has_balances = credit_balances.length > 0;

	const { mutate: createBalance } = useCreateCreditBalance();
	const { mutate: createCard } = useCreateCreditCard();

	const [ name, setName ] = useState('');
	const [ last_digits, setLastDigits ] = useState('');
	const [ share, setShare ] = useState(false);
	const [ credit_balance_id, setCreditBalanceId ] = useState('');
	const [ credit_limit, setCreditLimit ] = useState('');
	const [ closing_day, setClosingDay ] = useState('');
	const [ due_day, setDueDay ] = useState('');
	const [ submitting, setSubmitting ] = useState(false);
	const [ show_info, setShowInfo ] = useState(false);

	useEffect(() => {
		if (!visible) return;

		setName('');
		setLastDigits('');
		setCreditLimit('');
		setClosingDay('');
		setDueDay('');
		setSubmitting(false);
		setShowInfo(false);
		setShare(Boolean(defaultShareCreditBalanceId));
		setCreditBalanceId(defaultShareCreditBalanceId || '');
	}, [ visible, defaultShareCreditBalanceId ]);

	const handleClose = () => {
		setSubmitting(false);
		onClose();
	};

	const finish = (message: string) => {
		Toast.show({ type: 'success', text1: message });
		setSubmitting(false);
		onClose();
	};

	const fail = (error: unknown, fallback: string) => {
		Toast.show({ type: 'error', text1: getApiErrorMessage(error, fallback) });
		setSubmitting(false);
	};

	const is_submit_disabled = submitting
		|| !name
		|| (share ? !credit_balance_id : (!credit_limit || !closing_day || !due_day));

	const handleSave = () => {
		setSubmitting(true);

		if (share) {
			createCard({
				credit_balance_id,
				body: { name, last_digits: last_digits || undefined },
				onSuccess: () => finish('Cartão criado!'),
				onError: (error) => fail(error, 'Erro ao criar cartão'),
			});
			return;
		}

		if (!wallet_id) {
			setSubmitting(false);
			Toast.show({ type: 'error', text1: 'Selecione uma carteira para continuar' });
			return;
		}

		createBalance({
			wallet_id,
			body: {
				name,
				credit_limit: Number(MoneyUtils.unformatMoney(credit_limit)),
				closing_day: Number(closing_day),
				due_day: Number(due_day),
			},
			onSuccess: (created_balance) => {
				createCard({
					credit_balance_id: created_balance.id,
					body: { name: 'PRINCIPAL', last_digits: last_digits || undefined },
					onSuccess: () => finish('Cartão criado!'),
					onError: (error) => fail(error, 'Limite criado, mas houve um erro ao criar o cartão'),
				});
			},
			onError: (error) => fail(error, 'Erro ao criar limite'),
		});
	};

	const share_disabled = submitting || (!has_balances && !defaultShareCreditBalanceId);

	const balance_options = [
		{ label: 'Escolha o limite', value: '' },
		...credit_balances.map((credit_balance) => ({
			label: `${ credit_balance.name } · ${ MoneyUtils.formatMoney(credit_balance.credit_limit) }`,
			value: credit_balance.id,
		})),
	];

	return (
		<Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
			<KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
				<ThemedView style={styles.modalOverlay}>
					<ThemedView style={styles.modalContent}>
						<ThemedText style={styles.title}>Novo cartão</ThemedText>

						<ScrollView style={styles.scroll} keyboardShouldPersistTaps='handled'>
							<ThemedView style={styles.formGroup}>
								<ThemedTextInput
									label='Nome *'
									value={name}
									onChangeText={setName}
									placeholder='Ex.: Nubank, Físico, Virtual'
								/>
							</ThemedView>

							<ThemedView style={styles.formGroup}>
								<ThemedTextInput
									label='Últimos dígitos (opcional)'
									value={last_digits}
									onChangeText={(text) => setLastDigits(text.replace(/\D/g, '').slice(0, 4))}
									placeholder='Ex.: 1234'
									keyboardType='numeric'
									maxLength={4}
								/>
							</ThemedView>

							<View style={styles.checkboxBlock}>
								<View style={styles.checkboxRow}>
									<TouchableOpacity
										style={styles.checkboxToggle}
										onPress={() => setShare((prev) => !prev)}
										disabled={share_disabled}
										activeOpacity={0.7}
									>
										<Icon
											name={share ? 'check-box' : 'check-box-outline-blank'}
											size={22}
											color={share_disabled ? theme.colors.placeholder : colors['brand-secondary']}
										/>
										<ThemedText style={share_disabled ? { color: theme.colors.placeholder } : undefined}>Compartilhar limite</ThemedText>
									</TouchableOpacity>
									<TouchableOpacity onPress={() => setShowInfo((prev) => !prev)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
										<Icon name='info-outline' size={18} color={theme.colors.placeholder} />
									</TouchableOpacity>
								</View>

								{show_info && (
									<ThemedText style={styles.infoText}>
										Ao selecionar, este cartão poderá compartilhar o limite com outros cartões já cadastrados
									</ThemedText>
								)}

								{!has_balances && !defaultShareCreditBalanceId && (
									<ThemedText style={styles.helperText}>Você ainda não tem um limite para compartilhar — este cartão vai criar o primeiro.</ThemedText>
								)}
							</View>

							{share ? (
								<ThemedView style={styles.formGroup}>
									<SelectInput
										label='Limite compartilhado'
										options={balance_options}
										value={credit_balance_id}
										onChange={setCreditBalanceId}
									/>
									<ThemedText style={styles.helperText}>O cartão usa o limite e a fatura da linha escolhida — sem limite próprio.</ThemedText>
								</ThemedView>
							) : (
								<>
									<ThemedView style={styles.formGroup}>
										<ThemedTextInput
											label='Limite *'
											value={credit_limit}
											onChangeText={(text) => setCreditLimit(MoneyUtils.formatMoney(text))}
											placeholder='R$ 0,00'
											keyboardType='numeric'
										/>
									</ThemedView>

									<View style={styles.row}>
										<View style={styles.rowItem}>
											<ThemedTextInput
												label='Fechamento *'
												value={closing_day}
												onChangeText={(text) => setClosingDay(clampDay(text))}
												placeholder='Dia (1–31)'
												keyboardType='numeric'
												maxLength={2}
											/>
										</View>
										<View style={styles.rowItem}>
											<ThemedTextInput
												label='Vencimento *'
												value={due_day}
												onChangeText={(text) => setDueDay(clampDay(text))}
												placeholder='Dia (1–31)'
												keyboardType='numeric'
												maxLength={2}
											/>
										</View>
									</View>

									<ThemedText style={styles.helperText}>Este cartão cria um novo limite de crédito, com fatura própria.</ThemedText>
								</>
							)}
						</ScrollView>

						<ThemedView style={styles.buttonContainer}>
							<TouchableOpacity disabled={submitting} style={[ styles.button, styles.cancelButton ]} onPress={handleClose}>
								<ThemedText style={styles.buttonText}>Cancelar</ThemedText>
							</TouchableOpacity>
							<TouchableOpacity disabled={is_submit_disabled} style={[ styles.button, is_submit_disabled ? styles.saveButtonDisabled : styles.saveButton ]} onPress={handleSave}>
								<ThemedText style={styles.buttonText}>{submitting ? <Loader /> : 'Salvar'}</ThemedText>
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
		fontSize: 24,
		marginBottom: 20,
		textAlign: 'center',
	},
	formGroup: {
		marginBottom: 15,
	},
	row: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 15,
	},
	rowItem: {
		flex: 1,
	},
	checkboxBlock: {
		marginBottom: 15,
		gap: 8,
		backgroundColor: 'transparent',
	},
	checkboxRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	checkboxToggle: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	infoText: {
		fontSize: 13,
		color: '#888',
		backgroundColor: 'rgba(255, 255, 255, 0.06)',
		borderRadius: 8,
		padding: 10,
	},
	helperText: {
		fontSize: 12,
		color: '#888',
		marginTop: 4,
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

export default NewCardModal;
