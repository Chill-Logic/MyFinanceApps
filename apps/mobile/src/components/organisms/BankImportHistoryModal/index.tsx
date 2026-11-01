import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { BankConnectionUtils, colors, DateUtils, getApiErrorMessage } from '@myfinance/shared';

import { useIndexBankImports } from '../../../hooks/api/bank-imports/useIndexBankImports';
import { useUndoBankImport } from '../../../hooks/api/bank-imports/useUndoBankImport';

import { useTheme } from '../../../context/theme';

import { TBankAccountLink, TBankImport } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

interface BankImportHistoryModalProps {
	visible: boolean;
	onClose: ()=> void;
	link: TBankAccountLink | null;
}

const TONE_COLOR = {
	success: colors['feedback-success-default'],
	warning: colors['feedback-warning-default'],
	error: colors['feedback-danger-default'],
	neutral: '#888',
} as const;

export const BankImportHistoryModal = ({ visible, onClose, link }: BankImportHistoryModalProps) => {
	const { theme } = useTheme();
	const { data, isLoading } = useIndexBankImports({
		enabled: visible && Boolean(link),
		params: { bank_account_link_id: link?.id || '' },
	});
	const { mutate: undoMutation, isPending: is_undo_pending } = useUndoBankImport();

	const imports = data?.data || [];

	const handleUndo = (bank_import: TBankImport) => {
		Alert.alert(
			'Desfazer importação',
			'As transações criadas por esta importação serão removidas, as que ela alterou voltam ao que eram e as que ela removeu voltam.',
			[
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Desfazer',
					style: 'destructive',
					onPress: () => {
						undoMutation({
							id: bank_import.id,
							onSuccess: () => Toast.show({ type: 'success', text1: 'Importação desfeita' }),
							onError: (error) => Toast.show({
								type: 'error',
								text1: 'Não foi possível desfazer',
								text2: getApiErrorMessage(error, 'Tente novamente'),
							}),
						});
					},
				},
			],
		);
	};

	const renderImport = (bank_import: TBankImport) => {
		const status = BankConnectionUtils.importStatus(bank_import.status);
		const can_undo = bank_import.undoable && !is_undo_pending;

		return (
			<View key={bank_import.id} style={[ styles.item, { borderColor: theme.colors.border } ]}>
				<View style={styles.itemHeader}>
					<View style={styles.itemInfo}>
						<ThemedText>{DateUtils.formateTo(bank_import.created_at, 'dd/MM/yyyy \'às\' HH:mm')}</ThemedText>
						<ThemedText style={styles.subtle}>
							{BankConnectionUtils.importPeriodLabel(bank_import)}
							{` · ${ BankConnectionUtils.importModeLabel(bank_import.mode) }`}
							{` · ${ BankConnectionUtils.importTriggerLabel(bank_import.trigger) }`}
						</ThemedText>
					</View>
					<ThemedText style={[ styles.status, { color: TONE_COLOR[status.tone] } ]}>{status.label}</ThemedText>
				</View>

				<ThemedText style={styles.subtle}>
					{bank_import.status === 'failed'
						? bank_import.error_message || 'A importação falhou.'
						: BankConnectionUtils.importSummaryMessage([ bank_import ])}
				</ThemedText>

				{bank_import.status === 'completed' && (
					<View style={styles.undoRow}>
						<TouchableOpacity
							style={[ styles.undoButton, { borderColor: theme.colors.border }, !can_undo && styles.disabled ]}
							onPress={() => handleUndo(bank_import)}
							disabled={!can_undo}
						>
							<Icon name='undo' size={16} color={theme.colors.text} />
							<ThemedText style={styles.undoText}>Desfazer</ThemedText>
						</TouchableOpacity>
						{!bank_import.undoable && bank_import.undo_blocker ? (
							<ThemedText style={[ styles.subtle, styles.blocker ]}>{bank_import.undo_blocker}</ThemedText>
						) : null}
					</View>
				)}
			</View>
		);
	};

	return (
		<Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<View style={styles.header}>
						<ThemedText style={styles.title} numberOfLines={1}>Histórico</ThemedText>
						<TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Icon name='close' size={22} color={theme.colors.text} />
						</TouchableOpacity>
					</View>
					{link?.name ? <ThemedText style={styles.subtle}>{link.name}</ThemedText> : null}

					{isLoading && (
						<View style={styles.centered}>
							<Loader />
						</View>
					)}

					{!isLoading && imports.length === 0 && (
						<View style={styles.centered}>
							<Icon name='history' size={40} color={theme.colors.placeholder} />
							<ThemedText style={styles.emptyTitle}>Nenhuma importação ainda</ThemedText>
						</View>
					)}

					{!isLoading && imports.length > 0 && (
						<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
							{imports.map(renderImport)}
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
		marginBottom: 10,
		gap: 6,
	},
	itemHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	itemInfo: {
		flex: 1,
	},
	status: {
		fontSize: 12,
		fontWeight: '700',
	},
	undoRow: {
		alignItems: 'flex-end',
		gap: 4,
	},
	undoButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		borderWidth: 1,
		borderRadius: 6,
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	undoText: {
		fontSize: 14,
	},
	blocker: {
		textAlign: 'right',
	},
	disabled: {
		opacity: 0.5,
	},
});

export default BankImportHistoryModal;
