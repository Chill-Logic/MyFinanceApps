import { useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, MoneyUtils } from '@myfinance/shared';

import { useDeleteAccount } from '../../../hooks/api/accounts/useDeleteAccount';
import { useIndexAccounts } from '../../../hooks/api/accounts/useIndexAccounts';

import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TAccount, TAccountKind } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import { AccountFormModal } from '../AccountFormModal';

const KIND_ICON: Record<TAccountKind, string> = {
	checking: 'account-balance',
	savings: 'savings',
	cash: 'payments',
};

export const AccountList = () => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexAccounts({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: deleteAccountMutation } = useDeleteAccount();
	const { refreshControlProps } = useRefresh({ all: true });

	const [ actions_account, setActionsAccount ] = useState<TAccount | null>(null);
	const [ editing_account, setEditingAccount ] = useState<TAccount | null>(null);
	const [ is_creating, setIsCreating ] = useState(false);

	const accounts = data?.data || [];

	const handleDeleteAccount = (account: TAccount) => {
		setTimeout(() => {
			Alert.alert(
				'Excluir conta',
				`Deseja excluir "${ account.name }"? As transações vinculadas também serão removidas. Essa ação não pode ser desfeita.`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => {
							deleteAccountMutation({
								id: account.id,
								onSuccess: () => Toast.show({ type: 'success', text1: 'Conta removida com sucesso' }),
								onError: (error) => Toast.show({
									type: 'error',
									text1: 'Erro ao remover conta',
									text2: getApiErrorMessage(error, 'Tente novamente'),
								}),
							});
						},
					},
				],
			);
		}, 100);
	};

	const renderAccountItem = ({ item }: { item: TAccount }) => {
		const balance_color = Number(item.balance) >= 0 ? styles.textGreen : styles.textRed;

		return (
			<ThemedView style={[ styles.row, { backgroundColor: card_surface } ]}>
				<View style={styles.iconCircle}>
					<Icon name={KIND_ICON[item.kind] as never} size={20} color={colors['brand-secondary']} />
				</View>

				<View style={styles.info}>
					<ThemedText>{item.name}</ThemedText>
					<ThemedText style={styles.subtle}>{item.translated_kind}</ThemedText>
				</View>

				<ThemedText style={balance_color}>{MoneyUtils.formatMoney(Number(item.balance))}</ThemedText>

				<TouchableOpacity onPress={() => setActionsAccount(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='more-vert' size={22} color={theme.colors.placeholder} />
				</TouchableOpacity>
			</ThemedView>
		);
	};

	return (
		<ThemedView style={styles.container}>
			<TouchableOpacity style={styles.newButton} onPress={() => setIsCreating(true)}>
				<Icon name='add' size={20} color='#fff' />
				<ThemedText style={styles.newButtonText}>Nova conta</ThemedText>
			</TouchableOpacity>

			{isLoading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!isLoading && accounts.length === 0 && (
				<View style={styles.centered}>
					<ThemedText style={styles.emptyTitle}>Nenhuma conta ainda</ThemedText>
					<ThemedText style={styles.emptyMessage}>Crie uma conta para começar a registrar transações.</ThemedText>
				</View>
			)}

			{!isLoading && accounts.length > 0 && (
				<FlatList
					data={accounts}
					renderItem={renderAccountItem}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl {...refreshControlProps} />}
				/>
			)}

			<Modal visible={Boolean(actions_account)} transparent animationType='fade' onRequestClose={() => setActionsAccount(null)}>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setActionsAccount(null)}>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_account;
								setActionsAccount(null);
								if (target) setEditingAccount(target);
							}}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_account;
								setActionsAccount(null);
								if (target) handleDeleteAccount(target);
							}}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<AccountFormModal visible={is_creating} onClose={() => setIsCreating(false)} />
			<AccountFormModal visible={Boolean(editing_account)} account={editing_account} onClose={() => setEditingAccount(null)} />
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	newButton: {
		alignSelf: 'flex-end',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 16,
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
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	textGreen: {
		color: 'green',
		fontWeight: 'bold',
	},
	textRed: {
		color: 'red',
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

export default AccountList;
