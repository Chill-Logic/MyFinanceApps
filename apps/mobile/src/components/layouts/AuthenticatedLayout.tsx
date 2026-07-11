import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@myfinance/shared';
import type { AxiosError } from 'axios';

import useShowCurrentUser from '../../hooks/api/user/useShowCurrentUser';
import useTabNavigate from '../../hooks/useTabNavigate';

import { useCurrentUserContext } from '../../context/current_user';
import { useRefresh } from '../../context/refresh';
import { LocalStorage } from '../../services/storage';

import { IScreenProps } from '../../types/screen';
import { StorageKeys } from '../../types/storage';

import { Loader } from '../atoms/Loader';
import { ThemedView } from '../atoms/ThemedView';
import BottomNav from '../organisms/BottomNav';
import { WalletFormModal } from '../organisms/WalletFormModal';

const AuthenticatedLayout = ({ children, navigation }: { children: React.ReactNode; navigation: IScreenProps<any>['navigation'] }) => {
	const { current_user, setCurrentUser, logout } = useCurrentUserContext();
	const { refreshControlProps } = useRefresh({ all: true });
	const navigateToTab = useTabNavigate(navigation);

	const [ is_wallet_form_modal_visible, setIsWalletFormModalVisible ] = useState(false);

	/*
	 * Esse layout só é alcançado depois que o usuário já autenticou (fresco ou restaurado
	 * de uma sessão anterior via "manter logado") — a navegação em si já é a prova de que
	 * existe token no storage, então é aqui, e não no CurrentUserProvider (que vive a vida
	 * inteira do app, inclusive nas telas de login), que faz sentido checar o AsyncStorage e
	 * buscar o /users/me. Isso evita depender de qualquer tela de login "avisar" o contexto
	 * de que acabou de logar — cada vez que este layout monta, ele confere o storage de
	 * novo, sozinho.
	 */
	const [ has_token, setHasToken ] = useState(false);
	const [ has_checked_token, setHasCheckedToken ] = useState(false);

	useEffect(() => {
		(async() => {
			const token = await LocalStorage.getItem(StorageKeys.TOKEN);
			setHasToken(Boolean(token));
			setHasCheckedToken(true);
		})();
	}, []);

	const { data: current_user_data, error, isFetched } = useShowCurrentUser({ enabled: has_token });

	const is_loading = !has_checked_token || (has_token && !current_user.data && !isFetched);

	/*
	 * Só força logout em 401 de verdade (JWT ausente/inválido/expirado) — um erro de rede, 5xx
	 * ou um 404 passageiro (ex.: backend no meio de um deploy) não significa que a sessão do
	 * usuário é inválida, e derrubar o token nesses casos só pra "descobrir" que era transitório
	 * é pior do que deixar a query falhar e tentar de novo depois.
	 */
	const is_unauthorized = (error as AxiosError | null)?.response?.status === 401;

	const handleLogout = async() => {
		await logout();
		navigation.replace('SignIn');
	};

	useEffect(() => {
		if (current_user_data) {
			setCurrentUser({ data: current_user_data });
		}
	}, [ current_user_data, setCurrentUser ]);

	useEffect(() => {
		if (is_unauthorized) {
			logout().then(() => navigation.replace('SignIn'));
		}
	}, [ is_unauthorized, logout, navigation ]);

	useEffect(() => {
		if (current_user.data) {
			LocalStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(current_user.data));
		}
	}, [ current_user.data ]);

	if (is_loading) {
		return (
			<View style={styles.container}>
				<Loader />
			</View>
		);
	}

	return (
		<View style={styles.container} {...refreshControlProps}>
			<ThemedView style={styles.content}>
				{children}
			</ThemedView>

			<BottomNav
				navigate={navigateToTab}
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
