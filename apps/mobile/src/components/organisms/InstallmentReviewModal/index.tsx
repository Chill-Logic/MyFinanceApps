import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { BankConnectionUtils, colors, DateUtils, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useIndexPendingInstallmentReviews } from '../../../hooks/api/transactions/useIndexPendingInstallmentReviews';
import { useResolveInstallmentReview } from '../../../hooks/api/transactions/useResolveInstallmentReview';

import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TPendingInstallmentReview } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

interface InstallmentReviewModalProps {
	visible: boolean;
	onClose: ()=> void;
	/* Crédito cujas parcelas pendentes serão revisadas. */
	creditBalance: { id: string; name: string } | null;
}

const NEW_PURCHASE = 'new';

const suggestedGroup = (review: TPendingInstallmentReview) =>
	review.installment_candidates.find((candidate) => candidate.suggested)?.installment_group ?? review.installment_candidates[0]?.installment_group ?? NEW_PURCHASE;

const ReviewItem = ({ review }: { review: TPendingInstallmentReview }) => {
	const { theme } = useTheme();
	const { mutate: resolveMutation, isPending } = useResolveInstallmentReview();
	const [ selected_group, setSelectedGroup ] = useState(() => suggestedGroup(review));

	const installment_label = BankConnectionUtils.installmentLabel(review);

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { installment_group: selected_group },
			onSuccess: () => Toast.show({ type: 'success', text1: selected_group === NEW_PURCHASE ? 'Parcela registrada como compra nova' : 'Parcela confirmada' }),
			onError: (error) => Toast.show({
				type: 'error',
				text1: 'Erro ao confirmar a parcela',
				text2: getApiErrorMessage(error, 'Tente novamente'),
			}),
		});
	};

	const renderOption = (key: string, active: boolean, onPress: ()=> void, content: React.ReactNode) => (
		<TouchableOpacity
			key={key}
			style={[ styles.candidate, { borderColor: active ? colors['brand-secondary'] : theme.colors.border } ]}
			onPress={onPress}
			accessibilityRole='radio'
			accessibilityState={{ checked: active }}
		>
			<Icon
				name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
				size={20}
				color={active ? colors['brand-secondary'] : theme.colors.placeholder}
			/>
			<View style={styles.candidateInfo}>{content}</View>
		</TouchableOpacity>
	);

	return (
		<View style={[ styles.item, { borderColor: theme.colors.border } ]}>
			<View style={styles.itemHeader}>
				<View style={styles.itemInfo}>
					<ThemedText numberOfLines={1}>{review.description}</ThemedText>
					<ThemedText style={styles.subtle}>
						{DateUtils.formatDate(review.transaction_date)}
						{installment_label ? ` · parcela ${ installment_label }` : ''}
					</ThemedText>
				</View>
				<ThemedText style={styles.value}>{MoneyUtils.formatMoney(review.value)}</ThemedText>
			</View>

			{review.installment_candidates.map((candidate) => renderOption(
				candidate.installment_group,
				candidate.installment_group === selected_group,
				() => setSelectedGroup(candidate.installment_group),
				<>
					<ThemedText>
						{BankConnectionUtils.installmentCandidateLabel(candidate)}
						{candidate.suggested ? <ThemedText style={styles.subtle}> (sugerida)</ThemedText> : null}
					</ThemedText>
					<ThemedText style={styles.subtle}>
						{MoneyUtils.formatMoney(candidate.value)} · {candidate.installment_total}x
					</ThemedText>
				</>,
			))}

			{renderOption(NEW_PURCHASE, selected_group === NEW_PURCHASE, () => setSelectedGroup(NEW_PURCHASE), (
				<ThemedText>É uma compra nova</ThemedText>
			))}

			<TouchableOpacity
				style={[ styles.confirmButton, isPending && styles.disabled ]}
				onPress={handleConfirm}
				disabled={isPending}
			>
				{isPending ? <ActivityIndicator color='#fff' size='small' /> : <ThemedText style={styles.confirmText}>Confirmar</ThemedText>}
			</TouchableOpacity>
		</View>
	);
};

export const InstallmentReviewModal = ({ visible, onClose, creditBalance }: InstallmentReviewModalProps) => {
	const { theme } = useTheme();
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexPendingInstallmentReviews({
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
						<ThemedText style={styles.title} numberOfLines={1}>Parcelas para revisar</ThemedText>
						<TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Icon name='close' size={22} color={theme.colors.text} />
						</TouchableOpacity>
					</View>
					<ThemedText style={styles.subtle}>
						{creditBalance?.name ? `${ creditBalance.name } · ` : ''}
						Não deu para saber a qual compra parcelada estas parcelas pertencem. Confira a sugestão e confirme.
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

export default InstallmentReviewModal;
