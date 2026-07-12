import { useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage } from '@myfinance/shared';

import { useDeleteWallets } from '../../hooks/api/wallets/useDeleteWallets';
import { useIndexWallets } from '../../hooks/api/wallets/useIndexWallets';

import { useCurrentUserContext } from '../../context/current_user';
import { useTheme } from '../../context/theme';
import { useWallet } from '../../context/wallet';
import { MoneyUtils } from '../../utils/money';

import { TWallet } from '../../types/models';
import { IScreenProps } from '../../types/screen';

import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { WalletFormModal } from '../../components/organisms/WalletFormModal';
import { WalletInviteFormModal } from '../../components/organisms/WalletInviteFormModal';

const MyWalletsScreen = ({ navigation }: IScreenProps<'MyWallets'>) => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const { current_user } = useCurrentUserContext();
	const { user_wallet, setUserWallet } = useWallet();
	const { data: data_wallets, isLoading: is_data_wallets_loading } = useIndexWallets();
	const { mutate: deleteWalletMutation } = useDeleteWallets();

	const [ actions_wallet, setActionsWallet ] = useState<TWallet | null>(null);
	const [ editing_wallet, setEditingWallet ] = useState<TWallet | null>(null);
	const [ inviting_wallet, setInvitingWallet ] = useState<TWallet | null>(null);

	/*
	 * Excluir/editar/convidar são owner-only (o backend retorna 403 caso contrário) — o "..." só
	 * aparece pro dono. Ao excluir a carteira ativa, zeramos o contexto pra o WalletUserProvider
	 * rebuscar a principal. Alert dentro de setTimeout (100ms) pra o Modal do action sheet fechar
	 * antes — dois modais nativos abertos ao mesmo tempo brigam (mesmo padrão do TransactionList).
	 */
	const handleDeleteWallet = (wallet_to_delete: TWallet) => {
		setTimeout(() => {
			Alert.alert(
				'Excluir carteira',
				`Deseja excluir a carteira "${ wallet_to_delete.name }"? Essa ação não pode ser desfeita.`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Excluir',
						style: 'destructive',
						onPress: () => {
							deleteWalletMutation({
								id: wallet_to_delete.id,
								onSuccess: () => {
									Toast.show({ type: 'success', text1: 'Carteira removida com sucesso' });
									if (user_wallet.data?.id === wallet_to_delete.id) setUserWallet({ data: null });
								},
								onError: (error) => {
									Toast.show({
										type: 'error',
										text1: 'Erro ao remover carteira',
										text2: getApiErrorMessage(error, 'Tente novamente'),
									});
								},
							});
						},
					},
				],
			);
		}, 100);
	};

	const renderWalletItem = ({ item }: { item: TWallet }) => {
		const is_active = user_wallet.data?.id === item.id;
		const is_owner = current_user.data?.id === item.owner_id;
		const balance_color = Number(item.total) >= 0 ? styles.textGreen : styles.textRed;

		return (
			<ThemedView style={[ styles.walletRow, { backgroundColor: card_surface, borderColor: is_active ? colors['brand-secondary'] : card_surface } ]}>
				<View style={styles.walletInfo}>
					<ThemedText>{item.name}</ThemedText>
					{Boolean(item.total) && (
						<ThemedText style={balance_color}>Total: {MoneyUtils.formatMoney(Number(item.total))}</ThemedText>
					)}
				</View>

				{is_active && <Icon name='check-circle' size={20} color={colors['brand-secondary']} />}

				{is_owner && (
					<TouchableOpacity
						onPress={() => setActionsWallet(item)}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<Icon name='more-vert' size={22} color={theme.colors.placeholder} />
					</TouchableOpacity>
				)}
			</ThemedView>
		);
	};

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedView
					style={[
						styles.listContainer,
						data_wallets?.data.length ? styles.listContainerWithData : styles.listContainerEmpty,
					]}
				>
					{is_data_wallets_loading && <ThemedText>Carregando...</ThemedText>}

					{data_wallets && data_wallets.data.length > 0 ? (
						<FlatList
							data={data_wallets.data}
							renderItem={renderWalletItem}
							keyExtractor={(item) => item.id}
							showsVerticalScrollIndicator={false}
							removeClippedSubviews={true}
						/>
					) : (
						!is_data_wallets_loading && (
							<ThemedText style={styles.emptyMessage}>Não há carteiras para mostrar</ThemedText>
						)
					)}
				</ThemedView>
			</ThemedView>

			<Modal
				visible={Boolean(actions_wallet)}
				transparent
				animationType='fade'
				onRequestClose={() => setActionsWallet(null)}
			>
				<TouchableOpacity
					style={styles.actionsSheetOverlay}
					activeOpacity={1}
					onPress={() => setActionsWallet(null)}
				>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_wallet;
								setActionsWallet(null);
								if (target) setEditingWallet(target);
							}}
						>
							<Icon name='edit' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Editar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_wallet;
								setActionsWallet(null);
								if (target) setInvitingWallet(target);
							}}
						>
							<Icon name='person-add' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Convidar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.actionsSheetItem}
							onPress={() => {
								const target = actions_wallet;
								setActionsWallet(null);
								if (target) handleDeleteWallet(target);
							}}
						>
							<Icon name='delete' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Excluir</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<WalletFormModal
				visible={Boolean(editing_wallet)}
				wallet={editing_wallet}
				onClose={() => setEditingWallet(null)}
			/>

			<WalletInviteFormModal
				visible={Boolean(inviting_wallet)}
				wallet={inviting_wallet}
				onClose={() => setInvitingWallet(null)}
			/>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContainer: {
		flex: 1,
		borderRadius: 5,
	},
	listContainerWithData: {
		justifyContent: 'flex-start',
		alignItems: 'stretch',
	},
	listContainerEmpty: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	walletRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
		borderRadius: 8,
		borderWidth: 1,
		marginBottom: 10,
		padding: 14,
	},
	walletInfo: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	textGreen: {
		color: 'green',
		fontWeight: 'bold',
		fontSize: 16,
	},
	textRed: {
		color: 'red',
		fontWeight: 'bold',
		fontSize: 16,
	},
	emptyMessage: {
		textAlign: 'center',
		fontSize: 16,
		color: '#666',
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

export default MyWalletsScreen;
