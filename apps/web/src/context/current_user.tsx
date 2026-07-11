import { createContext, Dispatch, ReactNode, SetStateAction, useCallback, useContext, useEffect, useState } from 'react';

import type { AxiosError } from 'axios';

import useShowCurrentUser from '@/hooks/api/user/useShowCurrentUser';

import { AuthStorage } from '@/services/storage';

import { TUser } from '@/types';

export type TCurrentUserState = {
	data: TUser | null;
};

interface IContextType {
	current_user: TCurrentUserState;
	setCurrentUser: Dispatch<SetStateAction<TCurrentUserState>>;
	login: (token: string)=> void;
	logout: ()=> void;
	is_loading: boolean;
	is_authenticated: boolean;
}

const initialValue: IContextType = {
	current_user: { data: null },
	setCurrentUser: () => {},
	login: () => {},
	logout: () => {},
	is_loading: false,
	is_authenticated: false,
};

const CurrentUserContext = createContext(initialValue);

export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
	const [ current_user, setCurrentUser ] = useState<TCurrentUserState>({ data: null });
	/*
	 * Estado de verdade, não derivado de `AuthStorage.getToken()` computado a cada render — um
	 * `login`/`logout` no meio da sessão (sem reload de página) não faz o `CurrentUserProvider`
	 * re-renderizar sozinho só porque o `localStorage` mudou (isso não é reativo por si só); só
	 * atualizando um `useState` aqui é que os consumidores do contexto (guards de rota, etc.)
	 * são notificados. O valor inicial (lazy initializer) cobre o caso de reload de página com
	 * token ainda válido.
	 */
	const [ is_authenticated, setIsAuthenticated ] = useState(() => Boolean(AuthStorage.getToken()));

	const { data: current_user_data, error, isFetched } = useShowCurrentUser({ enabled: is_authenticated });

	/*
	 * Enquanto existe token mas ainda não temos usuário nem resposta definitiva (sucesso ou erro) da
	 * busca, estamos "carregando" — sem isso, quem consome o contexto não tem como distinguir "ainda
	 * carregando" de "não tem usuário mesmo".
	 */
	const is_loading = is_authenticated && !current_user.data && !isFetched;

	/*
	 * Só força logout em 401 de verdade (JWT ausente/inválido/expirado) — um erro de rede, 5xx
	 * ou um 404 passageiro (ex.: backend no meio de um deploy) não significa que a sessão do
	 * usuário é inválida; derrubar o token nesses casos kickaria o usuário fora à toa.
	 */
	const is_unauthorized = (error as AxiosError | null)?.response?.status === 401;

	useEffect(() => {
		if (current_user_data) {
			setCurrentUser({ data: current_user_data });
		}
	}, [ current_user_data ]);

	useEffect(() => {
		if (is_unauthorized) {
			AuthStorage.clearToken();
			setCurrentUser({ data: null });
			setIsAuthenticated(false);
		}
	}, [ is_unauthorized ]);

	/*
	 * `useCallback` (deps vazias, só usam setters estáveis de `useState`) de propósito — evita
	 * que `login`/`logout` sejam funções novas a cada render deste provider. Um efeito em outro
	 * componente que dependa dessas funções (ex.: pra redirecionar após deslogar) re-executaria
	 * a cada mudança de estado daqui, sem nunca convergir (já aconteceu no mobile).
	 */
	const login = useCallback((token: string) => {
		AuthStorage.setToken(token);
		setIsAuthenticated(true);
	}, []);

	const logout = useCallback(() => {
		AuthStorage.clearToken();
		setCurrentUser({ data: null });
		setIsAuthenticated(false);
	}, []);

	return (
		<CurrentUserContext.Provider value={{ current_user, setCurrentUser, login, logout, is_loading, is_authenticated }}>
			{children}
		</CurrentUserContext.Provider>
	);
};

export const useCurrentUserContext = () => {
	const context = useContext(CurrentUserContext);
	if (!context) {
		throw new Error('useCurrentUserContext must be used within an CurrentUserProvider');
	}
	return context;
};

export default CurrentUserProvider;
