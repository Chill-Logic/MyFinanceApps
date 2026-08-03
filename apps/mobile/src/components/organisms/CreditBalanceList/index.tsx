import { useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useDeleteCreditBalance } from '../../../hooks/api/credit-balances/useDeleteCreditBalance';
import { useGetInvoice } from '../../../hooks/api/credit-balances/useGetInvoice';
import { useIndexCreditBalances } from '../../../hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteCreditCard } from '../../../hooks/api/credit-cards/useDeleteCreditCard';
import { useIndexCreditCards } from '../../../hooks/api/credit-cards/useIndexCreditCards';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TCreditBalance, TCreditCard } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import { CreditBalanceFormModal } from '../CreditBalanceFormModal';
import { CreditCardFormModal } from '../CreditCardFormModal';
import { PayInvoiceModal } from '../PayInvoiceModal';

const MONTHS = [
	'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
	'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/* "2026-09-10" ou "2026-09-10T00:00:00-03:00" → "10/09" (só string, evita deslocamento de fuso). */
const formatDayMonth = (iso: string): string => {
	const [ , month, day ] = iso.split('T')[0].split('-');
	return day && month ? `${ day }/${ month }` : iso;
};

/* Data de referência do ciclo a partir de um offset de meses em relação a hoje (YYYY-MM-DD). */
const referenceFromOffset = (offset: number): string => {
	const now = new Date();
	const date = new Date(now.getFullYear(), now.getMonth() + offset, now.getDate());
	return `${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }-${ String(date.getDate()).padStart(2, '0') }`;
};

const referenceLabel = (reference_date: string): string => {
	const [ year, month ] = reference_date.split('-');
	return `${ MONTHS[Number(month) - 1] } ${ year }`;
};

const CreditBalanceCard = ({ credit_balance }: { credit_balance: TCreditBalance }) => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';

	const { data: cards_data, isLoading: is_cards_loading } = useIndexCreditCards({
		params: { credit_balance_id: credit_balance.id },
	});
	const { mutate: deleteBalanceMutation } = useDeleteCreditBalance();
	const { mutate: deleteCardMutation } = useDeleteCreditCard();

	const [ is_balance_actions_open, setIsBalanceActionsOpen ] = useState(false);
	const [ actions_card, setActionsCard ] = useState<TCreditCard | null>(null);
	const [ is_edit_open, setIsEditOpen ] = useState(false);
	const [ is_pay_open, setIsPayOpen ] = useState(false);
	const [ is_card_create_open, setIsCardCreateOpen ] = useState(false);
	const [ editing_card, setEditingCard ] = useState<TCreditCard | null>(null);
	/* 0 = ciclo atual (usa a fatura embutida no index, sem request); ±N navega ciclos vizinhos. */
	const [ cycle_offset, setCycleOffset ] = useState(0);

	const is_current_cycle = cycle_offset === 0;
	const reference_date = referenceFromOffset(cycle_offset);
	const { data: navigated_invoice, isFetching: is_invoice_fetching } = useGetInvoice({
		id: credit_balance.id,
		enabled: !is_current_cycle,
		params: { date: reference_date },
	});

	const cards = cards_data?.data || [];
	const invoice = is_current_cycle ? credit_balance.current_invoice : navigated_invoice;
	const is_invoice_loading = !is_current_cycle && is_invoice_fetching && !invoice;
	const limit = credit_balance.credit_limit || 0;
	const used_pct = limit > 0 ? Math.min(100, Math.max(0, (credit_balance.used / limit) * 100)) : 0;
	const can_pay = Boolean(invoice) && !invoice!.paid && invoice!.amount > 0;

	const handleDeleteBalance = () => {
		setTimeout(() => {
			Alert.alert(
				'Excluir crédito',
				`Deseja excluir "${ credit_balance.name }"? Os cartões e transações vinculados também serão removidos.`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => deleteBalanceMutation({
							id: credit_balance.id,
							onSuccess: () => Toast.show({ type: 'success', text1: 'Crédito removido com sucesso' }),
							onError: (error) => Toast.show({ type: 'error', text1: 'Erro ao remover crédito', text2: getApiErrorMessage(error, 'Tente novamente') }),
						}),
					},
				],
			);
		}, 100);
	};

	const handleDeleteCard = (card: TCreditCard) => {
		setTimeout(() => {
			Alert.alert(
				'Excluir cartão',
				`Deseja excluir o cartão "${ card.name }"?`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => deleteCardMutation({
							id: card.id,
							onSuccess: () => Toast.show({ type: 'success', text1: 'Cartão removido com sucesso' }),
							onError: (error) => Toast.show({ type: 'error', text1: 'Erro ao remover cartão', text2: getApiErrorMessage(error, 'Tente novamente') }),
						}),
					},
				],
			);
		}, 100);
	};

	return (
		<ThemedView style={[ styles.card, { backgroundColor: card_surface } ]}>
			<View style={styles.cardHeader}>
				<View style={styles.iconCircle}>
					<Icon name='credit-card' size={20} color={colors['brand-secondary']} />
				</View>
				<View style={styles.info}>
					<ThemedText style={styles.name}>{credit_balance.name}</ThemedText>
					<ThemedText style={styles.subtle}>{cards.length} cartã{cards.length === 1 ? 'o' : 'os'}</ThemedText>
				</View>
				<View style={styles.limitBox}>
					<ThemedText style={styles.limitLabel}>Limite</ThemedText>
					<ThemedText style={styles.limitValue}>{MoneyUtils.formatMoney(limit)}</ThemedText>
				</View>
				<TouchableOpacity onPress={() => setIsBalanceActionsOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='more-vert' size={22} color={theme.colors.placeholder} />
				</TouchableOpacity>
			</View>

			<View style={styles.usageBlock}>
				<View style={styles.usageTrack}>
					<View style={[ styles.usageFill, { width: `${ used_pct }%` } ]} />
				</View>
				<View style={styles.usageRow}>
					<ThemedText style={styles.subtle}>usado <ThemedText style={styles.usageStrong}>{MoneyUtils.formatMoney(credit_balance.used)}</ThemedText></ThemedText>
					<ThemedText style={styles.subtle}>disponível <ThemedText style={styles.usageStrong}>{MoneyUtils.formatMoney(credit_balance.available)}</ThemedText></ThemedText>
				</View>
			</View>

			<View style={styles.invoiceBlock}>
				<View style={styles.cycleNav}>
					<TouchableOpacity onPress={() => setCycleOffset((offset) => offset - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						<Icon name='chevron-left' size={24} color={theme.colors.text} />
					</TouchableOpacity>
					<View style={styles.cycleCenter}>
						<ThemedText style={styles.cycleTag}>{is_current_cycle ? 'Fatura atual' : 'Fatura'}</ThemedText>
						<ThemedText style={styles.cycleLabel}>{referenceLabel(reference_date)}</ThemedText>
					</View>
					<TouchableOpacity onPress={() => setCycleOffset((offset) => offset + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						<Icon name='chevron-right' size={24} color={theme.colors.text} />
					</TouchableOpacity>
				</View>

				<View style={styles.invoiceRow}>
					<View style={styles.invoiceInfo}>
						{is_invoice_loading ? (
							<Loader />
						) : (
							<ThemedText style={styles.invoiceAmount}>{MoneyUtils.formatMoney(invoice?.amount ?? 0)}</ThemedText>
						)}
						{invoice && (
							<ThemedText style={styles.subtle}>
								{formatDayMonth(invoice.cycle_start)} – {formatDayMonth(invoice.cycle_end)}
								{' · '}
								<ThemedText style={invoice.paid ? styles.paid : styles.due}>
									{invoice.paid ? 'paga' : `vence ${ formatDayMonth(invoice.due_date) }`}
								</ThemedText>
							</ThemedText>
						)}
					</View>
					<TouchableOpacity
						onPress={() => setIsPayOpen(true)}
						disabled={!can_pay}
						style={[ styles.payButton, !can_pay && styles.payButtonDisabled ]}
					>
						<ThemedText style={styles.payButtonText}>{invoice?.paid ? 'Fatura paga' : 'Pagar fatura'}</ThemedText>
					</TouchableOpacity>
				</View>
			</View>

			<View style={styles.cardsBlock}>
				{!is_cards_loading && cards.length === 0 && (
					<View style={styles.warningBox}>
						<Icon name='warning' size={16} color={colors['feedback-warning-dark']} />
						<ThemedText style={styles.warningText}>Cadastre um cartão para lançar compras neste crédito — sem cartão, ele não aparece como origem nas transações.</ThemedText>
					</View>
				)}

				{cards.map((card) => (
					<View key={card.id} style={styles.cardRow}>
						<Icon name='credit-card' size={16} color={theme.colors.placeholder} />
						<ThemedText style={styles.cardName}>
							{card.name}{card.last_digits ? <ThemedText style={styles.subtle}> ·· {card.last_digits}</ThemedText> : null}
						</ThemedText>
						<TouchableOpacity onPress={() => setActionsCard(card)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Icon name='more-vert' size={20} color={theme.colors.placeholder} />
						</TouchableOpacity>
					</View>
				))}

				<TouchableOpacity style={styles.addCardButton} onPress={() => setIsCardCreateOpen(true)}>
					<Icon name='add' size={18} color={theme.colors.text} />
					<ThemedText style={styles.addCardText}>Adicionar cartão</ThemedText>
				</TouchableOpacity>
			</View>

			<Modal visible={is_balance_actions_open} transparent animationType='fade' onRequestClose={() => setIsBalanceActionsOpen(false)}>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setIsBalanceActionsOpen(false)}>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity style={styles.actionsSheetItem} onPress={() => { setIsBalanceActionsOpen(false); setIsEditOpen(true); }}>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity style={styles.actionsSheetItem} onPress={() => { setIsBalanceActionsOpen(false); handleDeleteBalance(); }}>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<Modal visible={Boolean(actions_card)} transparent animationType='fade' onRequestClose={() => setActionsCard(null)}>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setActionsCard(null)}>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => { const target = actions_card; setActionsCard(null); if (target) setEditingCard(target); }}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => { const target = actions_card; setActionsCard(null); if (target) handleDeleteCard(target); }}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<CreditBalanceFormModal visible={is_edit_open} creditBalance={credit_balance} onClose={() => setIsEditOpen(false)} />
			<PayInvoiceModal
				visible={is_pay_open}
				onClose={() => setIsPayOpen(false)}
				creditBalance={credit_balance}
				invoice={invoice}
				referenceDate={is_current_cycle ? undefined : reference_date}
			/>
			<CreditCardFormModal visible={is_card_create_open} creditBalanceId={credit_balance.id} onClose={() => setIsCardCreateOpen(false)} />
			<CreditCardFormModal visible={Boolean(editing_card)} card={editing_card} onClose={() => setEditingCard(null)} />
		</ThemedView>
	);
};

const renderCreditBalanceItem = ({ item }: { item: TCreditBalance }) => <CreditBalanceCard credit_balance={item} />;

export const CreditBalanceList = () => {
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexCreditBalances({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});

	const [ is_creating, setIsCreating ] = useState(false);

	const credit_balances = data?.data || [];

	return (
		<ThemedView style={styles.container}>
			<TouchableOpacity style={styles.newButton} onPress={() => setIsCreating(true)} disabled={!wallet_id}>
				<Icon name='add' size={20} color='#fff' />
				<ThemedText style={styles.newButtonText}>Novo crédito</ThemedText>
			</TouchableOpacity>

			{isLoading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!isLoading && credit_balances.length === 0 && (
				<View style={styles.centered}>
					<ThemedText style={styles.emptyTitle}>Nenhum crédito ainda</ThemedText>
					<ThemedText style={styles.emptyMessage}>Cadastre um cartão de crédito com limite e datas de fechamento/vencimento.</ThemedText>
				</View>
			)}

			{!isLoading && credit_balances.length > 0 && (
				<FlatList
					data={credit_balances}
					renderItem={renderCreditBalanceItem}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
				/>
			)}

			<CreditBalanceFormModal visible={is_creating} onClose={() => setIsCreating(false)} />
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	newButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 12,
		marginBottom: 16,
	},
	newButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 6,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	emptyMessage: {
		textAlign: 'center',
		color: '#666',
	},
	card: {
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		gap: 14,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		backgroundColor: 'transparent',
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
	name: {
		fontWeight: 'bold',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	limitBox: {
		alignItems: 'flex-end',
		backgroundColor: 'transparent',
	},
	limitLabel: {
		fontSize: 11,
		color: '#888',
		textTransform: 'uppercase',
	},
	limitValue: {
		fontWeight: '600',
	},
	usageBlock: {
		gap: 6,
		backgroundColor: 'transparent',
	},
	usageTrack: {
		height: 8,
		borderRadius: 4,
		overflow: 'hidden',
		backgroundColor: 'rgba(255, 255, 255, 0.12)',
	},
	usageFill: {
		height: '100%',
		borderRadius: 4,
		backgroundColor: colors['brand-secondary'],
	},
	usageRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		backgroundColor: 'transparent',
	},
	usageStrong: {
		fontWeight: '600',
		fontSize: 13,
	},
	invoiceBlock: {
		gap: 10,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: 'rgba(255, 255, 255, 0.15)',
		paddingTop: 12,
		backgroundColor: 'transparent',
	},
	cycleNav: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	cycleCenter: {
		alignItems: 'center',
	},
	cycleTag: {
		fontSize: 11,
		color: '#888',
		textTransform: 'uppercase',
	},
	cycleLabel: {
		fontSize: 14,
		fontWeight: '500',
	},
	invoiceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		backgroundColor: 'transparent',
	},
	invoiceInfo: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	invoiceAmount: {
		fontSize: 18,
		fontWeight: '600',
	},
	paid: {
		color: colors['feedback-success-default'],
		fontWeight: '500',
		fontSize: 13,
	},
	due: {
		color: colors['feedback-warning-dark'],
		fontWeight: '500',
		fontSize: 13,
	},
	payButton: {
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 14,
	},
	payButtonDisabled: {
		backgroundColor: '#ccc',
	},
	payButtonText: {
		color: '#fff',
		fontWeight: 'bold',
	},
	cardsBlock: {
		gap: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: 'rgba(255, 255, 255, 0.15)',
		paddingTop: 12,
		backgroundColor: 'transparent',
	},
	warningBox: {
		flexDirection: 'row',
		gap: 8,
		alignItems: 'flex-start',
		backgroundColor: colors['feedback-warning-light'],
		borderRadius: 8,
		padding: 10,
	},
	warningText: {
		flex: 1,
		fontSize: 12,
		color: colors['feedback-warning-dark'],
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: 'rgba(255, 255, 255, 0.05)',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	cardName: {
		flex: 1,
	},
	addCardButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.15)',
		borderRadius: 8,
		paddingVertical: 10,
	},
	addCardText: {
		fontWeight: '500',
	},
	actionsSheetOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
	},
	actionsSheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 8,
		paddingBottom: 28,
	},
	actionsSheetItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	actionsSheetItemText: {
		fontSize: 16,
	},
});

export default CreditBalanceList;
