import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useIndexWallets } from '../../../hooks/api/wallets/useIndexWallets';

import { useCurrentUserContext } from '../../../context/current_user';
import { useRefresh } from '../../../context/refresh';
import { useWallet } from '../../../context/wallet';
import { LocalStorage } from '../../../services/storage';

import Dropdown from '../../atoms/Dropdown';
import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

import { version } from '../../../../package.json';

export interface IMenuOption {
	id: string;
	title: string;
	icon: string;
	onClick: ()=> void;
	metadata?: React.ReactNode;
}

interface ISidebarProps {
	onClose: ()=> void;
	options: IMenuOption[];
	navigate: (route: string)=> void;
}

const Sidebar = ({ onClose, options, navigate }: ISidebarProps) => {
	const { current_user } = useCurrentUserContext();
	const { user_wallet, setUserWallet } = useWallet();
	const { refresh, isRefreshing } = useRefresh({ all: true });

	const { data: data_wallets } = useIndexWallets({
		enabled: !!current_user?.data?.id,
	});

	const wallets_options = useMemo(() => {
		return data_wallets?.map((wallet) => ({
			label: wallet.name,
			value: wallet.id,
		})) || [];
	}, [ data_wallets ]);

	return (
		<ThemedView style={styles.container}>
			<TouchableOpacity
				style={[
					styles.refreshButton,
					isRefreshing && styles.refreshButtonLoading,
				]}
				onPress={() => {
					refresh();
				}}
				disabled={isRefreshing}
			>
				{isRefreshing ? <Loader /> : <Icon name='refresh' size={24} color='#666' />}
			</TouchableOpacity>

			<ThemedView style={styles.userInfo}>
				<ThemedText style={styles.userInfoName}>{current_user?.data?.name}</ThemedText>
				<ThemedText style={styles.userInfoEmail}>{current_user?.data?.email}</ThemedText>
			</ThemedView>

			<ThemedView style={styles.header}>
				<Dropdown
					label='Visualizando a carteira:'
					options={wallets_options}
					value={user_wallet?.data?.id || ''}
					onChange={(value: string) => {
						const new_wallet = data_wallets?.find((wallet) => wallet.id === value);
						if (new_wallet) {
							setUserWallet({ data: new_wallet });
						}

						onClose();
						navigate('Home');
					}}
					placeholder='Selecione uma carteira'
				/>
			</ThemedView>

			<ScrollView style={styles.menuContainer}>
				{options.map((item) => (
					<TouchableOpacity
						key={item.id}
						style={styles.menuItem}
						onPress={() => {
							item.onClick();
						}}
					>
						<Icon name={item.icon} size={24} color='#666' style={styles.menuIcon} />
						<ThemedText style={styles.menuText}>{item.title}</ThemedText>
						{item.metadata}
					</TouchableOpacity>
				))}
			</ScrollView>
			<TouchableOpacity
				style={styles.logoutButton}
				onPress={() => {
					LocalStorage.logout().then(() => {
						onClose();
						navigate('SignIn');
					});
				}}>
				<Icon name='logout' size={24} color='#900' />
				<ThemedText style={styles.logoutButtonText}>Sair</ThemedText>
			</TouchableOpacity>

			<ThemedView style={styles.footer}>
				<ThemedText style={styles.versionText}>v{version}</ThemedText>
			</ThemedView>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	userInfo: {
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#333',
	},
	userInfoName: {
		fontSize: 18,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	userInfoEmail: {
		fontSize: 14,
		color: '#666',
		textAlign: 'center',
	},
	container: {
		flex: 1,
		width: 280,
		paddingTop: 50,
	},
	refreshButton: {
		position: 'absolute',
		top: 10,
		right: 10,
	},
	refreshButtonLoading: {
		opacity: 0.5,
		transform: [ { rotate: '360deg' } ],
	},
	header: {
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#333',
	},
	closeButton: {
		padding: 5,
	},
	walletName: {
		fontSize: 18,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	menuContainer: {
		flex: 1,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#333',
	},
	menuIcon: {
		marginRight: 15,
	},
	menuText: {
		fontSize: 16,
	},
	footer: {
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: '#333',
		alignItems: 'center',
	},
	versionText: {
		fontSize: 12,
		color: '#666',
		fontWeight: 'bold',
	},
	logoutButton: {
		padding: 10,
		alignItems: 'center',
		justifyContent: 'center',
		flexDirection: 'row',
		gap: 10,
	},
	logoutButtonText: {
		fontSize: 14,
		color: '#900',
		fontWeight: 'bold',
	},
});

export default Sidebar;
