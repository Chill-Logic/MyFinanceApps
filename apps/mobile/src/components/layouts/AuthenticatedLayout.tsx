import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { colors } from '@myfinance/shared';
import type { AxiosError } from 'axios';

import useShowCurrentUser from '../../hooks/api/user/useShowCurrentUser';
import useTabNavigate from '../../hooks/useTabNavigate';

import { useCurrentUserContext } from '../../context/current_user';
import { useRefresh } from '../../context/refresh';
import { useTheme } from '../../context/theme';
import { LocalStorage } from '../../services/storage';

import { IScreenProps } from '../../types/screen';
import { StorageKeys } from '../../types/storage';

import { Loader } from '../atoms/Loader';
import { ThemedText } from '../atoms/ThemedText';
import { ThemedView } from '../atoms/ThemedView';
import BottomNav from '../organisms/BottomNav';
import { WalletFormModal } from '../organisms/WalletFormModal';

const AuthenticatedLayout = ({ children, navigation }: { children: React.ReactNode; navigation: IScreenProps<any>['navigation'] }) => {
	const { current_user, setCurrentUser, logout } = useCurrentUserContext();
	const { refreshControlProps } = useRefresh({ all: true });
	const { theme } = useTheme();
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

	const { data: current_user_data, error, refetch } = useShowCurrentUser({ enabled: has_token });

	/*
	 * Só força logout em 401 de verdade (JWT ausente/inválido/expirado) — um erro de rede, 5xx
	 * ou um 404 passageiro (ex.: backend no meio de um deploy) não significa que a sessão do
	 * usuário é inválida, e derrubar o token nesses casos só pra "descobrir" que era transitório
	 * é pior do que deixar a query falhar e tentar de novo depois.
	 */
	const is_unauthorized = (error as AxiosError | null)?.response?.status === 401;

	/*
	 * A Home só monta (e, com ela, todas as queries autenticadas de carteira/transações/convites)
	 * depois que o `/users/me` confirmar que o token é válido — enquanto `current_user.data` não
	 * estiver preenchido, seguramos no Loader. Isso é o que impede a cascata de requisições com
	 * token expirado no auto-login: o `/users/me` é a ÚNICA requisição que sai antes da validação;
	 * se ele der 401, ninguém mais chega a disparar com o token velho. Não dependemos de `isFetched`
	 * de propósito — num 401 a query "termina", mas ainda assim não há usuário validado, então
	 * continuar no Loader (enquanto o efeito abaixo redireciona pro SignIn) é o correto.
	 */
	const is_loading = !has_checked_token || (has_token && !current_user.data && !error);

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

	/*
	 * `is_unauthorized` também cai aqui: nesse caso `is_loading` já é `false` (tem `error`), mas
	 * não queremos montar a Home — o efeito de logout/redirect acima está a caminho, então
	 * mantemos o Loader até a navegação pro SignIn acontecer.
	 */
	if (is_loading || is_unauthorized) {
		return (
			<View style={[ styles.container, { backgroundColor: theme.colors.background } ]}>
				<Loader />
			</View>
		);
	}

	/*
	 * Erro NÃO-401 (rede/5xx/404 passageiro): não derruba a sessão (ver comentário do
	 * `is_unauthorized`), mas também não dá pra montar a Home sem o usuário carregado — mostra um
	 * retry em vez de travar num Loader infinito (as queries têm `retry: false`, então sem isso o
	 * usuário ficaria preso até reabrir o app).
	 */
	if (error) {
		return (
			<View style={[ styles.container, styles.centered, { backgroundColor: theme.colors.background } ]}>
				<ThemedText style={styles.errorText}>Não foi possível carregar sua conta.</ThemedText>
				<TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
					<ThemedText style={styles.retryText}>Tentar novamente</ThemedText>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={[ styles.container, { backgroundColor: theme.colors.background } ]} {...refreshControlProps}>
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
	centered: {
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	errorText: {
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 16,
	},
	retryButton: {
		height: 48,
		paddingHorizontal: 24,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	retryText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
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
