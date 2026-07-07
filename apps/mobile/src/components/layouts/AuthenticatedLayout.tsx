import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@myfinance/shared';

import useShowCurrentUser from '../../hooks/api/user/useShowCurrentUser';

import { useCurrentUserContext } from '../../context/current_user';
import { useRefresh } from '../../context/refresh';
import { LocalStorage } from '../../services/storage';

import { IScreenProps } from '../../types/screen';
import { StorageKeys } from '../../types/storage';

import { ThemedView } from '../atoms/ThemedView';
import BottomNav from '../organisms/BottomNav';
import { WalletFormModal } from '../organisms/WalletFormModal';

const AuthenticatedLayout = ({ children, navigation }: { children: React.ReactNode; navigation: IScreenProps<any>['navigation'] }) => {
	const { current_user, setCurrentUser } = useCurrentUserContext();
	const { data: current_user_data } = useShowCurrentUser();
	const { refreshControlProps } = useRefresh({ all: true });

	const [ is_wallet_form_modal_visible, setIsWalletFormModalVisible ] = useState(false);

	const handleLogout = () => {
		LocalStorage.logout().then(() => {
			setCurrentUser({ data: null });
			navigation.replace('SignIn');
		});
	};

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
		<View style={styles.container} {...refreshControlProps}>
			<ThemedView style={styles.content}>
				{children}
			</ThemedView>

			<BottomNav
				navigate={navigation.navigate}
				onNewWallet={() => setIsWalletFormModalVisible(true)}
				onLogout={handleLogout}
			/>

			<WalletFormModal
				visible={is_wallet_form_modal_visible}
				onClose={() => setIsWalletFormModalVisible(false)}
				onSuccess={() => setIsWalletFormModalVisible(false)}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors['background-default'],
	},
	content: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 20,
		/*
		 * Sem paddingBottom de propósito: esse container não rola mais como um todo — quem
		 * rola é a lista lá dentro (TransactionList tem seu próprio flex:1 + SectionList),
		 * então um padding-bottom aqui não é "respiro no fim do scroll" como seria no web
		 * (lá o padding vive dentro da área que rola, `main`) — aqui ele é uma faixa fixa
		 * sempre visível colada em cima da borda da BottomNav. Cada tela decide seu próprio
		 * espaçamento interno no fim do conteúdo, se precisar.
		 */
	},
});

export default AuthenticatedLayout;
