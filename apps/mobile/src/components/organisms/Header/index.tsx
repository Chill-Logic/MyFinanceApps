import { StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useWallet } from '../../../context/wallet';

import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

interface IHeaderProps {
	handleLogout: ()=> void;
	onOpenSidebar: ()=> void;
	onOpenSettings: ()=> void;
}

const Header = ({ handleLogout, onOpenSidebar, onOpenSettings }: IHeaderProps) => {
	const { user_wallet } = useWallet();

	return (
		<ThemedView style={styles.header}>
			<TouchableOpacity style={styles.headerButton} onPress={onOpenSidebar}>
				<Icon name='menu' size={24} color='#666' />
			</TouchableOpacity>
			<ThemedText style={styles.title}>{user_wallet.data?.name}</ThemedText>
			<ThemedView style={styles.headerButtons}>
				<TouchableOpacity style={styles.headerButton} onPress={onOpenSettings}>
					<Icon name='settings' size={24} color='#666' />
				</TouchableOpacity>

				<TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
					<Icon name='logout' size={24} color='#900' />
				</TouchableOpacity>
			</ThemedView>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 18,
	},
	headerButtons: {
		flexDirection: 'row',
		gap: 10,
	},
	headerButton: {
		padding: 10,
	},
	title: {
		fontSize: 20,
	},
});

export default Header;
