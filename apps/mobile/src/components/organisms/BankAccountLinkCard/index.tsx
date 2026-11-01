import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { BANK_AUTO_SYNC_HELP, BANK_BEST_PURCHASE_DAY_HELP, BankConnectionUtils, colors, DateUtils, getApiErrorMessage } from '@myfinance/shared';

import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';
import { useUpdateBankAccountLink } from '../../../hooks/api/bank-account-links/useUpdateBankAccountLink';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';

import { useTheme } from '../../../context/theme';

import { TBankAccountLinkBody } from '../../../types/api';
import { TBankAccountLink } from '../../../types/models';

import SelectInput from '../../atoms/SelectInput';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedTextInput } from '../../atoms/ThemedTextInput';
import { ThemedView } from '../../atoms/ThemedView';

import { BankImportHistoryModal } from '../BankImportHistoryModal';
import { BankImportModal } from '../BankImportModal';

interface BankAccountLinkCardProps {
	link: TBankAccountLink;
	/* Carteira da conexão — o destino tem que ser dela. */
	walletId: string;
}

const TONE_COLOR = {
	success: colors['feedback-success-default'],
	warning: colors['feedback-warning-default'],
	error: colors['feedback-danger-default'],
	neutral: '#888',
} as const;

const targetValue = (link: TBankAccountLink) => {
	if (link.status === 'linked' && link.target_id) return link.target_id;
	if (link.status === 'ignored') return 'none';
	return '';
};

export const BankAccountLinkCard = ({ link, walletId }: BankAccountLinkCardProps) => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const is_credit = link.external_type === 'CREDIT';

	const { data: accounts_data } = useIndexAccounts({ enabled: !is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { mutate: updateLinkMutation, isPending } = useUpdateBankAccountLink();

	const [ is_import_open, setIsImportOpen ] = useState(false);
	const [ is_history_open, setIsHistoryOpen ] = useState(false);
	const [ best_purchase_day, setBestPurchaseDay ] = useState(String(link.suggested_best_purchase_day ?? ''));

	useEffect(() => {
		setBestPurchaseDay(String(link.suggested_best_purchase_day ?? ''));
	}, [ link.suggested_best_purchase_day ]);

	const targets = (is_credit ? credit_balances_data?.data : accounts_data?.data) || [];
	const status = BankConnectionUtils.linkStatus(link.status);
	const amount_label = BankConnectionUtils.linkAmountLabel(link);
	const is_linked = link.status === 'linked';
	const needs_best_purchase_day = is_credit && is_linked && link.best_purchase_day_status === 'pending';
	const best_purchase_day_number = Number(best_purchase_day);
	const is_best_purchase_day_valid = Number.isInteger(best_purchase_day_number) && best_purchase_day_number >= 1 && best_purchase_day_number <= 31;
	const current_value = targetValue(link);

	const options = [
		...(current_value === '' ? [ { label: 'Escolha o destino', value: '' } ] : []),
		{ label: is_credit ? 'Criar novo cartão' : 'Criar nova conta', value: 'new' },
		...targets.map((target) => ({ label: target.name, value: target.id })),
		...(is_linked && link.target_id && !targets.some((target) => target.id === link.target_id)
			? [ { label: link.target_name || 'Destino atual', value: link.target_id } ]
			: []),
		{ label: 'Não importar', value: 'none' },
	];

	const updateLink = (body: TBankAccountLinkBody, success_message: string) => {
		updateLinkMutation({
			id: link.id,
			body,
			onSuccess: () => Toast.show({ type: 'success', text1: success_message }),
			onError: (error) => Toast.show({
				type: 'error',
				text1: 'Erro ao atualizar o vínculo',
				text2: getApiErrorMessage(error, 'Tente novamente'),
			}),
		});
	};

	const handleTargetChange = (target: string) => {
		if (!target || target === current_value) return;

		const messages: Record<string, string> = {
			new: is_credit ? 'Cartão criado e vinculado' : 'Conta criada e vinculada',
			none: 'Esta conta não será importada',
		};

		updateLink({ target }, messages[target] || 'Vínculo atualizado');
	};

	return (
		<ThemedView style={[ styles.card, { backgroundColor: card_surface } ]}>
			<View style={styles.header}>
				<View style={styles.iconCircle}>
					<Icon name={is_credit ? 'credit-card' : 'account-balance'} size={20} color={colors['brand-secondary']} />
				</View>
				<View style={styles.info}>
					<ThemedText numberOfLines={1}>{link.name}</ThemedText>
					<ThemedText style={styles.subtle} numberOfLines={2}>
						{BankConnectionUtils.linkTypeLabel(link)}
						{link.number ? ` · ${ link.number }` : ''}
						{amount_label ? ` · ${ amount_label }` : ''}
					</ThemedText>
				</View>
				<ThemedText style={[ styles.status, { color: TONE_COLOR[status.tone] } ]}>{status.label}</ThemedText>
			</View>

			<SelectInput label='Importar para' options={options} value={current_value} onChange={handleTargetChange} disabled={isPending} />

			{needs_best_purchase_day && (
				<View style={styles.bestDayBox}>
					<View style={styles.bestDayMessage}>
						<Icon name='warning' size={16} color={colors['feedback-warning-default']} />
						<ThemedText style={styles.bestDayText}>{BANK_BEST_PURCHASE_DAY_HELP(link.suggested_best_purchase_day)}</ThemedText>
					</View>
					<View style={styles.bestDayRow}>
						<View style={styles.bestDayInput}>
							<ThemedTextInput
								label='Melhor dia de compra'
								value={best_purchase_day}
								onChangeText={(text) => setBestPurchaseDay(text.replace(/\D/g, '').slice(0, 2))}
								keyboardType='number-pad'
								maxLength={2}
							/>
						</View>
						<TouchableOpacity
							style={[ styles.confirmButton, (!is_best_purchase_day_valid || isPending) && styles.disabled ]}
							disabled={!is_best_purchase_day_valid || isPending}
							onPress={() => updateLink({ best_purchase_day: best_purchase_day_number }, 'Melhor dia de compra confirmado')}
						>
							{isPending ? <ActivityIndicator color='#fff' size='small' /> : <ThemedText style={styles.confirmText}>Confirmar</ThemedText>}
						</TouchableOpacity>
					</View>
				</View>
			)}

			{is_linked && (
				<View style={styles.autoSyncRow}>
					<View style={styles.info}>
						<ThemedText style={styles.autoSyncTitle}>Sincronizar automaticamente (diário, a partir de hoje)</ThemedText>
						<ThemedText style={styles.subtle}>{BANK_AUTO_SYNC_HELP}</ThemedText>
						{link.auto_sync && link.auto_sync_since ? (
							<ThemedText style={styles.subtle}>Ativa desde {DateUtils.formatDate(link.auto_sync_since)}</ThemedText>
						) : null}
					</View>
					<Switch
						value={link.auto_sync}
						disabled={isPending}
						onValueChange={(checked) => updateLink(
							{ auto_sync: checked },
							checked ? 'Sincronização automática ativada' : 'Sincronização automática desativada',
						)}
						trackColor={{ true: colors['brand-secondary'], false: theme.colors.border }}
					/>
				</View>
			)}

			{(is_linked || link.last_imported_at) && (
				<View style={styles.footer}>
					<ThemedText style={[ styles.subtle, styles.footerText ]}>
						{link.last_imported_at
							? `Última importação em ${ DateUtils.formateTo(link.last_imported_at, 'dd/MM/yyyy \'às\' HH:mm') }`
							: 'Nada importado ainda'}
					</ThemedText>
					<View style={styles.actions}>
						<TouchableOpacity onPress={() => setIsHistoryOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<ThemedText style={styles.link}>Histórico</ThemedText>
						</TouchableOpacity>
						{is_linked && (
							<TouchableOpacity style={styles.importButton} onPress={() => setIsImportOpen(true)}>
								<Icon name='download' size={18} color='#fff' />
								<ThemedText style={styles.importButtonText}>Importar período</ThemedText>
							</TouchableOpacity>
						)}
					</View>
				</View>
			)}

			<BankImportModal visible={is_import_open} onClose={() => setIsImportOpen(false)} link={link} />
			<BankImportHistoryModal visible={is_history_open} onClose={() => setIsHistoryOpen(false)} link={link} />
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 8,
		padding: 14,
		marginBottom: 12,
		gap: 10,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	iconCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
	},
	info: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	status: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
	},
	autoSyncRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	autoSyncTitle: {
		fontWeight: '600',
	},
	footer: {
		gap: 8,
	},
	footerText: {
		fontSize: 12,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: 16,
	},
	link: {
		color: colors['brand-secondary'],
		fontWeight: '600',
	},
	importButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 14,
	},
	bestDayBox: {
		gap: 8,
		borderWidth: 1,
		borderColor: colors['feedback-warning-default'],
		borderRadius: 8,
		padding: 10,
		backgroundColor: 'rgba(239, 176, 3, 0.10)',
	},
	bestDayMessage: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 6,
	},
	bestDayText: {
		flex: 1,
		fontSize: 13,
	},
	bestDayRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 10,
	},
	bestDayInput: {
		width: 160,
	},
	confirmButton: {
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		minWidth: 110,
		alignItems: 'center',
	},
	confirmText: {
		color: '#fff',
		fontWeight: 'bold',
	},
	disabled: {
		opacity: 0.6,
	},
	importButtonText: {
		color: '#fff',
		fontWeight: 'bold',
	},
});

export default BankAccountLinkCard;
