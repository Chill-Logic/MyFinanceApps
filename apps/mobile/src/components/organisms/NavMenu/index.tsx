import { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import { colors } from '@myfinance/shared';
import Constants from 'expo-constants';

import { useListInvites } from '../../../hooks/api/user-wallets/useListInvites';
import { useIndexWallets } from '../../../hooks/api/wallets/useIndexWallets';
import useNavItems from '../../../hooks/useNavItems';

import { useCurrentUserContext } from '../../../context/current_user';
import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import Dropdown from '../../atoms/Dropdown';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

const version = Constants.expoConfig?.version;

interface INavMenuProps {
	visible: boolean;
	onClose: ()=> void;
	navigate: (route: string)=> void;
	onNewWallet: ()=> void;
	onLogout: ()=> void;
}

/**
 * Equivalente ao NavLinks + Popover do apps/web: menu flutuante (não um drawer de tela
 * inteira) ancorado perto do botão de hambúrguer da BottomNav, reunindo o que antes estava
 * espalhado entre o Header (nome da carteira, configurações, logout) e o Sidebar em drawer
 * (wallet switcher, refresh, opções de menu, versão).
 */
const NavMenu = ({ visible, onClose, navigate, onNewWallet, onLogout }: INavMenuProps) => {
	const { theme } = useTheme();
	const { current_user } = useCurrentUserContext();
	const { user_wallet, setUserWallet } = useWallet();
	const { refresh, isRefreshing } = useRefresh({ all: true });

	const { data: data_wallets } = useIndexWallets({
		enabled: !!current_user?.data?.id,
	});
	const { data: data_invites } = useListInvites();
	const { navItems } = useNavItems();

	const wallets_options = useMemo(() => (
		data_wallets?.data.map((wallet) => ({ label: wallet.name, value: wallet.id })) || []
	), [ data_wallets ]);

	const handleNavigate = (route: string) => {
		onClose();
		navigate(route);
	};

	return (
		<Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
			<TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
				<TouchableOpacity activeOpacity={1} style={styles.menuWrapper}>
					<ThemedView style={[ styles.menuCard, { borderColor: theme.colors.border } ]}>
						<View style={styles.menuHeader}>
							<View style={styles.menuHeaderInfo}>
								<ThemedText numberOfLines={1} style={styles.userName}>{current_user?.data?.name}</ThemedText>
								<ThemedText numberOfLines={1} style={styles.userEmail}>{current_user?.data?.email}</ThemedText>
							</View>
							<TouchableOpacity onPress={refresh} disabled={isRefreshing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								{isRefreshing ? (
									<ActivityIndicator size='small' color={theme.colors.placeholder} />
								) : (
									<Icon name='refresh' size={20} color={theme.colors.placeholder} />
								)}
							</TouchableOpacity>
						</View>

						<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

						<Dropdown
							label='Visualizando a carteira:'
							options={wallets_options}
							value={user_wallet?.data?.id || ''}
							onChange={(value: string) => {
								const new_wallet = data_wallets?.data.find((wallet) => wallet.id === value);
								if (new_wallet) setUserWallet({ data: new_wallet });
								handleNavigate('Home');
							}}
							placeholder='Selecione uma carteira'
						/>

						<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

						{navItems.map((item) => (
							<TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => handleNavigate(item.route)}>
								<Icon name={item.icon as any} size={20} color={theme.colors.text} />
								<ThemedText style={styles.menuItemText}>{item.label}</ThemedText>
								{item.id === 'wallets_invites' && Boolean(data_invites?.data.length) && (
									<ThemedText style={styles.invitesCount}>{data_invites?.data.length}</ThemedText>
								)}
							</TouchableOpacity>
						))}

						<TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onNewWallet(); }}>
							<Icon name='create-new-folder' size={20} color={theme.colors.text} />
							<ThemedText style={styles.menuItemText}>Nova Carteira</ThemedText>
						</TouchableOpacity>

						<View style={[ styles.divider, { backgroundColor: theme.colors.border } ]} />

						<TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('WalletsSettings')}>
							<Icon name='settings' size={20} color={theme.colors.text} />
							<ThemedText style={styles.menuItemText}>Configurações</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); onLogout(); }}>
							<Icon name='logout' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.menuItemText, { color: colors['feedback-danger-default'] } ]}>Sair</ThemedText>
						</TouchableOpacity>

						<ThemedText style={styles.version}>v{version}</ThemedText>
					</ThemedView>
				</TouchableOpacity>
			</TouchableOpacity>
		</Modal>
	);
};

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
		justifyContent: 'flex-end',
		alignItems: 'flex-end',
	},
	menuWrapper: {
		paddingRight: 12,
		paddingBottom: 76,
	},
	menuCard: {
		width: 280,
		borderRadius: 12,
		borderWidth: 1,
		padding: 16,
		gap: 4,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
	},
	menuHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	menuHeaderInfo: {
		flex: 1,
	},
	userName: {
		fontSize: 14,
		fontWeight: '700',
	},
	userEmail: {
		fontSize: 12,
		color: '#868686',
	},
	divider: {
		height: 1,
		marginVertical: 8,
	},
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 10,
	},
	menuItemText: {
		flex: 1,
		fontSize: 14,
	},
	invitesCount: {
		color: 'white',
		fontSize: 11,
		fontWeight: 'bold',
		borderRadius: 100,
		backgroundColor: colors['brand-secondary'],
		width: 20,
		height: 20,
		textAlign: 'center',
		lineHeight: 20,
	},
	version: {
		marginTop: 8,
		fontSize: 11,
		color: '#868686',
		textAlign: 'center',
	},
});

export default NavMenu;
