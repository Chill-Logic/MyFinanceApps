import { useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, DateUtils, getApiErrorMessage, MoneyUtils, RecurrenceUtils, type TRecurrenceType } from '@myfinance/shared';

import { useDeleteRecurrence } from '../../../hooks/api/recurrences/useDeleteRecurrence';
import { useIndexRecurrences } from '../../../hooks/api/recurrences/useIndexRecurrences';

import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TRecurrence } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import SegmentedControl from '../../atoms/SegmentedControl';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import { RecurrenceFormModal } from '../RecurrenceFormModal';

const TYPE_SEGMENTS = [
	{ value: 'recurring', label: 'Recorrentes', icon: 'repeat' },
	{ value: 'installment', label: 'Parceladas', icon: 'credit-card' },
];

/* Sinal/cor pelo tipo: entrada +verde, saída −vermelho, transferência neutra (a lista não tem "visão" de contas). */
const VALUE_STYLE = {
	deposit: { sign: '+', color: colors['feedback-success-default'] },
	withdraw: { sign: '-', color: colors['feedback-danger-default'] },
	transfer: { sign: '', color: colors['feedback-info-default'] },
};

const KIND_ICON = {
	deposit: 'arrow-downward',
	withdraw: 'arrow-upward',
	transfer: 'swap-horiz',
} as const;

export const RecurrenceList = () => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const [ recurrence_type, setRecurrenceType ] = useState<TRecurrenceType>('recurring');
	const [ actions_recurrence, setActionsRecurrence ] = useState<TRecurrence | null>(null);
	const [ editing_recurrence, setEditingRecurrence ] = useState<TRecurrence | null>(null);

	const { data, isLoading } = useIndexRecurrences({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '', recurrence_type, per_page: 100 },
	});
	const { mutate: deleteRecurrenceMutation } = useDeleteRecurrence();
	const { refreshControlProps } = useRefresh({ all: true });

	const recurrences = data?.data || [];

	const handleDelete = (recurrence: TRecurrence) => {
		setTimeout(() => {
			Alert.alert(
				recurrence.recurrence_type === 'installment' ? 'Excluir compra parcelada' : 'Excluir recorrência',
				`Excluir "${ recurrence.description }"? As previstas de hoje em diante serão removidas. As já lançadas ficam.`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => deleteRecurrenceMutation({
							id: recurrence.id,
							onSuccess: () => Toast.show({ type: 'success', text1: 'Removida com sucesso' }),
							onError: (error) => Toast.show({
								type: 'error',
								text1: 'Erro ao remover',
								text2: getApiErrorMessage(error, 'Tente novamente'),
							}),
						}),
					},
				],
			);
		}, 100);
	};

	const renderItem = ({ item }: { item: TRecurrence }) => {
		const value_style = VALUE_STYLE[item.kind];

		return (
			<ThemedView style={[ styles.row, { backgroundColor: card_surface } ]}>
				<View style={styles.iconCircle}>
					<Icon name={KIND_ICON[item.kind]} size={18} color={value_style.color} />
				</View>

				<View style={styles.info}>
					<ThemedText style={styles.description} numberOfLines={1}>{item.description}</ThemedText>
					<ThemedText style={styles.subtle} numberOfLines={1}>
						{RecurrenceUtils.ruleLabel(item)} · {item.source_name}
					</ThemedText>
					<View style={styles.metaRow}>
						{item.next_occurrence && (
							<ThemedText style={styles.subtle}>Próxima: {DateUtils.formateTo(item.next_occurrence.transaction_date, 'dd/MM')}</ThemedText>
						)}
						{item.origin === 'bank' && <ThemedText style={styles.bankBadge}>do banco</ThemedText>}
					</View>
				</View>

				<ThemedText style={[ styles.value, { color: value_style.color } ]}>
					{value_style.sign}{MoneyUtils.formatMoney(item.value)}
				</ThemedText>

				<TouchableOpacity onPress={() => setActionsRecurrence(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='more-vert' size={22} color={theme.colors.placeholder} />
				</TouchableOpacity>
			</ThemedView>
		);
	};

	return (
		<ThemedView style={styles.container}>
			<View style={styles.typeWrapper}>
				<SegmentedControl
					segments={TYPE_SEGMENTS}
					value={recurrence_type}
					onChange={(next) => setRecurrenceType(next as TRecurrenceType)}
				/>
			</View>

			{isLoading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!isLoading && recurrences.length === 0 && (
				<View style={styles.centered}>
					<Icon name='repeat' size={36} color={theme.colors.placeholder} />
					<ThemedText style={styles.emptyTitle}>
						{recurrence_type === 'installment' ? 'Nenhuma compra parcelada' : 'Nenhuma recorrência'}
					</ThemedText>
					<ThemedText style={styles.emptyMessage}>Crie uma ao lançar uma transação, em Repetir.</ThemedText>
				</View>
			)}

			{!isLoading && recurrences.length > 0 && (
				<FlatList
					data={recurrences}
					renderItem={renderItem}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl {...refreshControlProps} />}
				/>
			)}

			<Modal visible={Boolean(actions_recurrence)} transparent animationType='fade' onRequestClose={() => setActionsRecurrence(null)}>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setActionsRecurrence(null)}>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_recurrence;
								setActionsRecurrence(null);
								if (target) setEditingRecurrence(target);
							}}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_recurrence;
								setActionsRecurrence(null);
								if (target) handleDelete(target);
							}}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<RecurrenceFormModal
				visible={Boolean(editing_recurrence)}
				recurrence={editing_recurrence}
				onClose={() => setEditingRecurrence(null)}
			/>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	typeWrapper: {
		marginBottom: 16,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 16,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	emptyMessage: {
		textAlign: 'center',
		color: '#666',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderRadius: 8,
		marginBottom: 10,
		padding: 14,
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
	description: {
		fontSize: 15,
		lineHeight: 20,
		fontWeight: '600',
	},
	subtle: {
		color: '#888',
		fontSize: 12,
		lineHeight: 16,
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	bankBadge: {
		fontSize: 10,
		lineHeight: 14,
		paddingHorizontal: 6,
		borderRadius: 999,
		overflow: 'hidden',
		color: colors['feedback-info-default'],
		borderWidth: 1,
		borderColor: colors['feedback-info-default'],
	},
	value: {
		fontSize: 14,
		lineHeight: 18,
		fontWeight: 'bold',
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

export default RecurrenceList;
