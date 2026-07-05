import { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useUpdateWallets } from '../../hooks/api/wallets/useUpdateWallets';

import { TWalletState, useWallet } from '../../context/wallet';

import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedTextInput } from '../../components/atoms/ThemedTextInput';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { WalletInviteFormModal } from '../../components/organisms/WalletInviteFormModal';

const WalletsSettingsScreen = ({ navigation }: IScreenProps<'WalletsSettings'>) => {
	const { user_wallet, setUserWallet } = useWallet();
	const [ is_modal_visible, setIsModalVisible ] = useState(false);
	const [ wallet_name, setWalletName ] = useState('');
	const { mutate: updateWalletMutation, isPending: is_update_wallet_pending } = useUpdateWallets();

	const handleSave = () => {
		if (user_wallet.data?.id) {
			updateWalletMutation({
				id: user_wallet.data.id,
				body: { name: wallet_name },
				onSuccess: () => {
					Toast.show({
						type: 'success',
						text1: 'Carteira atualizada!',
						text2: 'A carteira foi atualizada com sucesso',
					});
					setIsModalVisible(false);
					setUserWallet(prev => (
						{
							...prev,
							data: {
								...prev.data,
								name: wallet_name,
							},
						} as TWalletState
					));
				},
				onError: () => {
					Toast.show({
						type: 'error',
						text1: 'Erro ao atualizar carteira!',
						text2: 'Ocorreu um erro ao atualizar a carteira',
					});
				},
			});
		}
	};

	useEffect(() => {
		if (user_wallet.data?.name) {
			setWalletName(user_wallet.data.name);
		}
	}, [ user_wallet.data?.name ]);

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedView style={styles.content}>
					<ThemedView style={styles.formGroup}>
						<ThemedTextInput
							label='Nome da carteira'
							value={wallet_name}
							onChangeText={(text) => setWalletName(text)}
							placeholder='Digite o nome da carteira'
							keyboardType='default'
							autoCapitalize='none'
						/>
					</ThemedView>
				</ThemedView>

				<ThemedView style={styles.footer}>
					<ThemedView style={styles.buttonsContainer}>
						<TouchableOpacity
							style={styles.actionButton}
							disabled={is_update_wallet_pending}
							onPress={() => {
								setIsModalVisible(true);
							}}
						>
							<Icon name='person-add' size={24} color='#fff' />
							<ThemedText style={styles.actionButtonText}>
								Convidar
							</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity
							disabled={is_update_wallet_pending || is_modal_visible || user_wallet.data?.name === wallet_name || !wallet_name}
							onPress={handleSave}
							style={[ styles.actionButton, is_update_wallet_pending || is_modal_visible || user_wallet.data?.name === wallet_name || !wallet_name ? styles.actionButtonDisabled : {} ]}
						>
							<Icon name='save' size={24} color='#fff' />
							<ThemedText style={styles.actionButtonText}>
								{(is_update_wallet_pending) ? <Loader /> : 'Salvar'}
							</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</ThemedView>
			</ThemedView>

			<WalletInviteFormModal
				visible={is_modal_visible}
				onClose={() => setIsModalVisible(false)}
			/>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
	},
	formGroup: {
		marginBottom: 15,
	},
	footer: {
		paddingTop: 20,
		paddingBottom: 10,
	},
	buttonsContainer: {
		flexDirection: 'row',
		gap: 15,
	},
	actionButton: {
		flex: 1,
		height: 50,
		backgroundColor: '#A328D6',
		borderRadius: 5,
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row',
		gap: 10,
	},
	actionButtonDisabled: {
		opacity: 0.5,
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

export default WalletsSettingsScreen;
