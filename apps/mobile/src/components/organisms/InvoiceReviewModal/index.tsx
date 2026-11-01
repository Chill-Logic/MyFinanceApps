import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, DateUtils, getApiErrorMessage, InvoiceUtils, MoneyUtils } from '@myfinance/shared';

import { useIndexPendingInvoiceReviews } from '../../../hooks/api/transactions/useIndexPendingInvoiceReviews';
import { useResolveInvoiceReview } from '../../../hooks/api/transactions/useResolveInvoiceReview';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TPendingInvoiceReview } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

interface InvoiceReviewModalProps {
	visible: boolean;
	onClose: ()=> void;
	/* Crédito cujas pendências serão revisadas. */
	creditBalance: { id: string; name: string } | null;
}

const suggestedMonth = (review: TPendingInvoiceReview) =>
	review.invoice_candidates.find((candidate) => candidate.suggested)?.invoice_month ?? review.invoice_candidates[0]?.invoice_month ?? '';

const ReviewItem = ({ review }: { review: TPendingInvoiceReview }) => {
	const { theme } = useTheme();
	const { mutate: resolveMutation, isPending } = useResolveInvoiceReview();
	const [ selected_month, setSelectedMonth ] = useState(() => suggestedMonth(review));

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { invoice_month: selected_month },
			onSuccess: () => Toast.show({ type: 'success', text1: `Pagamento confirmado na fatura de ${ InvoiceUtils.monthLabel(selected_month) }` }),
			onError: (error) => Toast.show({
				type: 'error',
				text1: 'Erro ao confirmar a fatura',
				text2: getApiErrorMessage(error, 'Tente novamente'),
			}),
		});
	};

	return (
		<View style={[ styles.item, { borderColor: theme.colors.border } ]}>
			<View style={styles.itemHeader}>
				<View style={styles.itemInfo}>
					<ThemedText numberOfLines={1}>{review.description}</ThemedText>
					<ThemedText style={styles.subtle}>{DateUtils.formatDate(review.settled_date || review.transaction_date)}</ThemedText>
				</View>
				<ThemedText style={styles.value}>{MoneyUtils.formatMoney(review.value)}</ThemedText>
			</View>

			{review.invoice_candidates.map((candidate) => {
				const active = candidate.invoice_month === selected_month;

				return (
					<TouchableOpacity
						key={candidate.invoice_month}
						style={[ styles.candidate, { borderColor: active ? colors['brand-secondary'] : theme.colors.border } ]}
						onPress={() => setSelectedMonth(candidate.invoice_month)}
						accessibilityRole='radio'
						accessibilityState={{ checked: active }}
					>
						<Icon
							name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
							size={20}
							color={active ? colors['brand-secondary'] : theme.colors.placeholder}
						/>
						<View style={styles.candidateInfo}>
							<ThemedText>
								Fatura {InvoiceUtils.label(candidate)}
								{candidate.suggested ? <ThemedText style={styles.subtle}> (sugerida)</ThemedText> : null}
							</ThemedText>
							<ThemedText style={styles.subtle}>
								Vence {DateUtils.formatDate(candidate.due_date)} · em aberto {MoneyUtils.formatMoney(candidate.open_amount)}
							</ThemedText>
						</View>
					</TouchableOpacity>
				);
			})}

			<TouchableOpacity
				style={[ styles.confirmButton, (isPending || !selected_month) && styles.disabled ]}
				onPress={handleConfirm}
				disabled={isPending || !selected_month}
			>
				{isPending ? <ActivityIndicator color='#fff' size='small' /> : <ThemedText style={styles.confirmText}>Confirmar</ThemedText>}
			</TouchableOpacity>
		</View>
	);
};

export const InvoiceReviewModal = ({ visible, onClose, creditBalance }: InvoiceReviewModalProps) => {
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexPendingInvoiceReviews({
		enabled: visible && Boolean(wallet_id) && Boolean(creditBalance),
		params: {
			wallet_id: wallet_id || '',
			source_type: 'CreditBalance',
			source_id: creditBalance?.id,
			per_page: 50,
		},
	});

	const reviews = data?.data || [];

	return (
		<Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<View style={styles.header}>
						<ThemedText style={styles.title} numberOfLines={1}>Faturas a confirmar</ThemedText>
						<TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Icon name='close' size={22} color={theme.colors.text} />
						</TouchableOpacity>
					</View>
					<ThemedText style={styles.subtle}>
						{creditBalance?.name ? `${ creditBalance.name } · ` : ''}
						Não deu para saber de qual fatura são estes pagamentos. Confira a sugestão e confirme.
					</ThemedText>

					{isLoading && (
						<View style={styles.centered}>
							<Loader />
						</View>
					)}

					{!isLoading && reviews.length === 0 && (
						<View style={styles.centered}>
							<Icon name='check-circle' size={40} color={colors['feedback-success-default']} />
							<ThemedText style={styles.emptyTitle}>Nenhuma pendência</ThemedText>
						</View>
					)}

					{!isLoading && reviews.length > 0 && (
						<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
							{reviews.map((review) => (
								<ReviewItem key={review.id} review={review} />
							))}
						</ScrollView>
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
		maxHeight: '85%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
		gap: 8,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	title: {
		flex: 1,
		fontSize: 20,
		fontWeight: 'bold',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 24,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	list: {
		marginTop: 8,
	},
	item: {
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
		gap: 8,
	},
	itemHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	itemInfo: {
		flex: 1,
	},
	value: {
		color: colors['feedback-success-default'],
		fontWeight: 'bold',
	},
	candidate: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		borderRadius: 6,
		paddingVertical: 8,
		paddingHorizontal: 10,
	},
	candidateInfo: {
		flex: 1,
	},
	confirmButton: {
		alignSelf: 'flex-end',
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 8,
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
});

export default InvoiceReviewModal;
