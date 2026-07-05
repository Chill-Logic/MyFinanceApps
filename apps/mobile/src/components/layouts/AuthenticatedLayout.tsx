import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';

import { useListInvites } from '../../hooks/api/user-wallets/useListInvites';
import useShowCurrentUser from '../../hooks/api/user/useShowCurrentUser';

import { useCurrentUserContext } from '../../context/current_user';
import { useRefresh } from '../../context/refresh';
import { LocalStorage } from '../../services/storage';

import { IScreenProps } from '../../types/screen';
import { StorageKeys } from '../../types/storage';

import { ThemedText } from '../atoms/ThemedText';
import { ThemedView } from '../atoms/ThemedView';
import Header from '../organisms/Header';
import Sidebar, { IMenuOption } from '../organisms/Sidebar';
import { WalletFormModal } from '../organisms/WalletFormModal';

const AuthenticatedLayout = ({ children, navigation }: { children: React.ReactNode; navigation: IScreenProps<any>['navigation'] }) => {
	const { current_user, setCurrentUser } = useCurrentUserContext();
	const { data: current_user_data } = useShowCurrentUser();
	const { refreshControlProps } = useRefresh({ all: true });

	const [ isSidebarOpen, setIsSidebarOpen ] = useState(false);
	const [ is_wallet_form_modal_visible, setIsWalletFormModalVisible ] = useState(false);

	const { data: data_invites } = useListInvites();

	const slideAnim = useState(new Animated.Value(-280))[0];
	const handleLogout = () => {
		LocalStorage.logout().then(() => {
			setCurrentUser({ data: null });
			navigation.replace('SignIn');
		});
	};

	const handleOpenSidebar = () => {
		setIsSidebarOpen(true);
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start();
	};

	const handleCloseSidebar = () => {
		Animated.timing(slideAnim, {
			toValue: -280,
			duration: 300,
			useNativeDriver: true,
		}).start(() => {
			setIsSidebarOpen(false);
		});
	};

	const menuOptions: IMenuOption[] = [
		{ id: 'home', title: 'Início', icon: 'home', onClick: () => navigation.navigate('Home') },
		{
			id: 'wallets_invites',
			title: 'Convites',
			icon: 'group-add',
			onClick: () => navigation.navigate('WalletsInvites'),
			metadata: data_invites?.length ? <ThemedText style={styles.invitesCount}>{data_invites?.length}</ThemedText> : null,
		},
		{ id: 'my_wallets', title: 'Minhas Carteiras', icon: 'wallet', onClick: () => navigation.navigate('MyWallets') },
		{ id: 'new_wallet', title: 'Nova Carteira', icon: 'create-new-folder', onClick: () => setIsWalletFormModalVisible(true) },
	];

	useEffect(() => {
		(async() => {
			const keep_logged_in = await LocalStorage.getItem(StorageKeys.KEEP_LOGGED_IN);

			if (current_user_data && (!current_user.data || current_user.data.id !== current_user_data.id)) {
				if (keep_logged_in === 'true') {
					LocalStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(current_user_data));
				}
				setCurrentUser({ data: current_user_data });
			}
		})();
	}, [ current_user_data, current_user, setCurrentUser ]);

	return (
		<SafeAreaView style={styles.container} {...refreshControlProps}>
			<Header
				handleLogout={handleLogout}
				onOpenSidebar={handleOpenSidebar}
				onOpenSettings={() => {
					navigation.navigate('WalletsSettings');
				}}
			/>

			<ThemedView style={styles.content}>
				{children}
			</ThemedView>

			<Modal
				visible={isSidebarOpen}
				transparent={true}
				animationType='none'
				onRequestClose={handleCloseSidebar}
			>
				<TouchableOpacity
					style={styles.overlay}
					activeOpacity={1}
					onPress={handleCloseSidebar}
				>
					<Animated.View
						style={[
							styles.sidebarContainer,
							{
								transform: [ { translateX: slideAnim } ],
							},
						]}
					>
						<Sidebar
							onClose={handleCloseSidebar}
							options={menuOptions}
							navigate={navigation.navigate}
						/>
					</Animated.View>
				</TouchableOpacity>
			</Modal>

			<WalletFormModal
				visible={is_wallet_form_modal_visible}
				onClose={() => setIsWalletFormModalVisible(false)}
				onSuccess={() => setIsWalletFormModalVisible(false)}
			/>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		padding: 20,
	},
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	sidebarContainer: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		width: 280,
		backgroundColor: '#fff',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	invitesCount: {
		color: '#fff',
		fontSize: 12,
		fontWeight: 'bold',
		borderRadius: 100,
		backgroundColor: '#A328D6',
		marginLeft: 10,
		width: 20,
		height: 20,
		textAlign: 'center',
		lineHeight: 20,
	},
});

export default AuthenticatedLayout;
