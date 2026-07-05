import { StyleSheet, FlatList, TouchableOpacity } from 'react-native';

import { useIndexWallets } from '../../hooks/api/wallets/useIndexWallets';

import { useWallet } from '../../context/wallet';
import { MoneyUtils } from '../../utils/money';

import { TWallet } from '../../types/models';
import { IScreenProps } from '../../types/screen';

import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';

const MyWalletsScreen = ({ navigation }: IScreenProps<'WalletsInvites'>) => {
	const { user_wallet, setUserWallet } = useWallet();
	const { data: data_wallets, isLoading: is_data_wallets_loading } = useIndexWallets();

	const renderWalletItem = ({ item }: { item: TWallet }) => {
		const getBalanceColor = (value: number) => (
			value >= 0 ? styles.textGreen : styles.textRed
		);
		return (
			<TouchableOpacity
				style={[
					styles.actionButton,
					user_wallet.data?.id === item.id && styles.actionButtonSelected,
				]}
				onPress={() => {
					setUserWallet({ data: item });
					navigation.navigate('Home');
				}}
			>
				<ThemedText >{item.name}</ThemedText>
				{item.total && (
					<ThemedText style={[ getBalanceColor(Number(item.total)) ]}>Total: {MoneyUtils.formatMoney(Number(item.total))}</ThemedText>
				)}
			</TouchableOpacity>
		);
	};

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedView
					style={[
						styles.transactionsContainer,
						data_wallets?.length
							? styles.transactionsContainerWithData
							: styles.transactionsContainerEmpty,
					]}
				>
					{is_data_wallets_loading && (
						<ThemedText>Carregando...</ThemedText>
					)}

					{data_wallets && data_wallets?.length > 0 ? (
						<FlatList
							data={data_wallets}
							renderItem={renderWalletItem}
							keyExtractor={(item) => item.id}
							showsVerticalScrollIndicator={false}
							removeClippedSubviews={true}
						/>
					) : (
						<ThemedText style={styles.emptyMessage}>
							Não há carteiras para mostrar
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
		backgroundColor: '#3333',
		borderRadius: 5,
		justifyContent: 'center',
		borderWidth: 1,
		marginBottom: 10,
		padding: 10,
	},
	actionButtonSelected: {
		backgroundColor: '#333',

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

export default MyWalletsScreen;
