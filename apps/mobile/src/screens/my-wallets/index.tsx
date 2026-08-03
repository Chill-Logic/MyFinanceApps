import { useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors, getApiErrorMessage, QUERY_KEYS } from '@myfinance/shared';

import { useUpdateCurrentUser } from '../../hooks/api/user/useUpdateCurrentUser';
import { useDeleteWallets } from '../../hooks/api/wallets/useDeleteWallets';
import { useGetMainWallet } from '../../hooks/api/wallets/useGetMainWallet';
import { useIndexWallets } from '../../hooks/api/wallets/useIndexWallets';

import { useCurrentUserContext } from '../../context/current_user';
import { useTheme } from '../../context/theme';
import { useWallet } from '../../context/wallet';
import { queryClient } from '../../services/query-client';
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

	const { data: main_wallet } = useGetMainWallet({
		enabled: Boolean(current_user.data?.id),
		params: { user_id: current_user.data?.id || '' },
	});
	const { mutate: updateCurrentUserMutation } = useUpdateCurrentUser();

	const [ actions_wallet, setActionsWallet ] = useState<TWallet | null>(null);
	const [ editing_wallet, setEditingWallet ] = useState<TWallet | null>(null);
	const [ inviting_wallet, setInvitingWallet ] = useState<TWallet | null>(null);
	const [ setting_main_id, setSettingMainId ] = useState<string | null>(null);

	/*
	 * Definir carteira principal (PATCH /users/me com main_wallet_id) — vale pra qualquer carteira
	 * acessível/aceita, não só as próprias. Invalida a query da principal pra o badge atualizar (o
	 * hook de update do usuário só invalida o /users/me sozinho). Mesmo comportamento do web.
	 */
	const handleSetMain = (wallet: TWallet) => {
		setSettingMainId(wallet.id);
		updateCurrentUserMutation({
			body: { main_wallet_id: wallet.id },
			onSuccess: () => {
				Toast.show({ type: 'success', text1: `"${ wallet.name }" agora é sua carteira principal` });
				queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
				setSettingMainId(null);
			},
			onError: (error) => {
				Toast.show({ type: 'error', text1: 'Erro ao definir carteira principal', text2: getApiErrorMessage(error, 'Tente novamente') });
				setSettingMainId(null);
			},
		});
	};

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
		const is_main = main_wallet?.id === item.id;
		const balance_color = Number(item.total) >= 0 ? styles.textGreen : styles.textRed;

		return (
			<ThemedView style={[ styles.walletRow, { backgroundColor: card_surface, borderColor: is_active ? colors['brand-secondary'] : card_surface } ]}>
				<View style={styles.walletInfo}>
					<View style={styles.walletNameRow}>
						<ThemedText numberOfLines={1} style={styles.walletName}>{item.name}</ThemedText>
						{is_main && (
							<View style={styles.mainBadge}>
								<Icon name='star' size={12} color={colors['brand-secondary']} />
								<ThemedText style={styles.mainBadgeText}>Principal</ThemedText>
							</View>
						)}
					</View>
					{Boolean(item.total) && (
						<ThemedText style={balance_color}>Total: {MoneyUtils.formatMoney(Number(item.total))}</ThemedText>
					)}
				</View>

				{is_active && <Icon name='check-circle' size={20} color={colors['brand-secondary']} />}

				{(is_owner || !is_main) && (
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
						{actions_wallet && main_wallet?.id !== actions_wallet.id && (
							<TouchableOpacity
								style={styles.actionsSheetItem}
								disabled={setting_main_id === actions_wallet.id}
								onPress={() => {
									const target = actions_wallet;
									setActionsWallet(null);
									if (target) handleSetMain(target);
								}}
							>
								<Icon name='star' size={20} color={colors['brand-secondary']} />
								<ThemedText style={styles.actionsSheetItemText}>Definir como principal</ThemedText>
							</TouchableOpacity>
						)}

						{current_user.data?.id === actions_wallet?.owner_id && (
							<>
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
							</>
						)}
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
	walletNameRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: 'transparent',
	},
	walletName: {
		flexShrink: 1,
	},
	mainBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		borderRadius: 100,
		paddingHorizontal: 8,
		paddingVertical: 2,
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
	},
	mainBadgeText: {
		fontSize: 11,
		fontWeight: '600',
		color: colors['brand-secondary'],
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
