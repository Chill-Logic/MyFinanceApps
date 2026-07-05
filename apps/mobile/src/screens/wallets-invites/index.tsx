import { TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAcceptInvites } from '../../hooks/api/user-wallets/useAcceptInvites';
import { useListInvites } from '../../hooks/api/user-wallets/useListInvites';
import { useRejectInvites } from '../../hooks/api/user-wallets/useRejectInvites';

import { useRefresh } from '../../context/refresh';

import { TInvite } from '../../types/models';
import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';

import { QUERY_KEYS } from '../../constants/QueryKeys';

const WalletsInvitesScreen = ({ navigation }: IScreenProps<'WalletsInvites'>) => {
	const { data: data_invites, isLoading: is_data_invites_loading, refetch: refetch_invites } = useListInvites();
	const { mutate: acceptInviteMutation, isPending: is_accept_invite_pending } = useAcceptInvites();
	const { mutate: rejectInviteMutation, isPending: is_reject_invite_pending } = useRejectInvites();

	const { refreshControlProps } = useRefresh({
		keys: [
			QUERY_KEYS.invite.get_all,
		],
	});

	const renderInviteIem = ({ item }: { item: TInvite }) => (
		<ThemedView style={styles.inviteItem}>
			<ThemedView style={styles.inviteInfo}>
				<ThemedText style={styles.inviteOwnerName}>{item.owner_name}</ThemedText>
				<ThemedText style={styles.inviteWalletName}>{item.wallet_name}</ThemedText>
			</ThemedView>

			<ThemedView style={styles.inviteActions}>
				<TouchableOpacity
					disabled={is_accept_invite_pending || is_reject_invite_pending}
					style={styles.acceptButton}
					onPress={() => {
						acceptInviteMutation({
							id: item.id,
							onSuccess: () => {
								refetch_invites();
								Toast.show({
									text1: 'Convite aceito com sucesso',
									type: 'success',
								});
							},
						});
					}}>
					<ThemedText>	{is_accept_invite_pending ? <Loader /> : <Icon name='check' size={20} color='green' />}</ThemedText>
				</TouchableOpacity>

				<TouchableOpacity
					disabled={is_reject_invite_pending || is_accept_invite_pending}
					style={styles.rejectButton}
					onPress={() => {
						rejectInviteMutation({
							id: item.id,
							onSuccess: () => {
								refetch_invites();
								Toast.show({
									text1: 'Convite rejeitado com sucesso',
									type: 'success',
								});
							},
						});
					}}>
					<ThemedText>	{is_reject_invite_pending ? <Loader /> : <Icon name='close' size={20} color='red' />}</ThemedText>
				</TouchableOpacity>
			</ThemedView>
		</ThemedView>
	);

	const renderSeparator = () => (
		<ThemedView style={styles.transactionSeparator} />
	);

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedView
					style={[
						styles.transactionsContainer,
						data_invites?.length
							? styles.transactionsContainerWithData
							: styles.transactionsContainerEmpty,
					]}
				>
					{is_data_invites_loading && (
						<ThemedText>Carregando...</ThemedText>
					)}

					{data_invites && data_invites?.length > 0 ? (
						<FlatList
							data={data_invites}
							renderItem={renderInviteIem}
							keyExtractor={(item) => item.id}
							style={styles.transactionsList}
							refreshControl={<RefreshControl {...refreshControlProps} onRefresh={refetch_invites} />}
							showsVerticalScrollIndicator={false}
							removeClippedSubviews={true}
							maxToRenderPerBatch={10}
							windowSize={10}
							initialNumToRender={10}
							ItemSeparatorComponent={renderSeparator}
						/>
					) : (
						<ThemedText style={styles.emptyMessage}>
							Não há convites para mostrar
						</ThemedText>
					)}
				</ThemedView>
			</ThemedView>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	transactionsContainer: {
		flex: 1,
		borderRadius: 5,
	},
	transactionsContainerWithData: {
		justifyContent: 'space-between',
		alignItems: 'stretch',
	},
	transactionsContainerEmpty: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	buttonsContainer: {
		flexDirection: 'row',
		gap: 15,
		marginTop: 15,
	},
	actionButton: {
		flex: 1,
		height: 50,
		backgroundColor: '#A328D6',
		borderRadius: 5,
		justifyContent: 'center',
		alignItems: 'center',
	},
	actionButtonText: {
		color: 'white',
		fontSize: 18,
	},
	balanceContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 16,
		marginBottom: 16,
		paddingHorizontal: 4,
	},
	balanceLabel: {
		fontWeight: 'bold',
		textTransform: 'uppercase',
		fontSize: 16,
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
	transactionsList: {
		maxHeight: '95%',
	},
	emptyMessage: {
		textAlign: 'center',
		fontSize: 16,
		color: '#666',
	},
	transactionSeparator: {
		height: 1,
		backgroundColor: '#ccc',
	},
	inviteItem: {
		padding: 10,
		borderRadius: 5,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	inviteInfo: {
		flexDirection: 'column',
		gap: 5,
	},
	inviteOwnerName: {
		fontSize: 20,
		fontWeight: 'bold',
	},
	inviteWalletName: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	inviteActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginTop: 10,
	},
	acceptButton: {
		padding: 10,
		borderRadius: 5,
	},
	rejectButton: {
		padding: 10,
		borderRadius: 5,
	},
});

export default WalletsInvitesScreen;
