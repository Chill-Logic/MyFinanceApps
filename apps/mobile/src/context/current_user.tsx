import { createContext, Dispatch, ReactNode, SetStateAction, useCallback, useContext, useState } from 'react';

import { LocalStorage } from '../services/storage';

import { TUser } from '../types/models';

export type TCurrentUserState = {
	data: TUser | null;
};

interface IContextType {
	current_user: TCurrentUserState;
	setCurrentUser: Dispatch<SetStateAction<TCurrentUserState>>;
	logout: ()=> Promise<void>;
}

const initialValue: IContextType = {
	current_user: { data: null },
	setCurrentUser: () => {},
	logout: async() => {},
};

const CurrentUserContext = createContext(initialValue);

export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
	const [ current_user, setCurrentUser ] = useState<TCurrentUserState>({ data: null });

	/*
	 * Precisa terminar a limpeza do AsyncStorage ANTES de quem chamou navegar pra SignIn —
	 * essa tela lê USER_DATA no mount pra decidir se auto-loga de novo (sempre restauramos a
	 * sessão, não existe mais um flag "manter logado" opcional). Se `logout` fosse
	 * fire-and-forget (só disparar a Promise sem aguardar, como antes), existia uma corrida
	 * real: navegar antes da limpeza terminar podia deixar o efeito de restauração da
	 * SignInScreen ler o USER_DATA antigo ainda não removido e logar o usuário de volta, como
	 * se o "Sair" não tivesse feito nada.
	 *
	 * `useCallback` (deps vazias) de propósito — `setCurrentUser` é o dispatch do `useState`,
	 * garantidamente estável entre renders. Sem isso, `logout` seria uma função nova a cada
	 * render deste provider, e quem consome ela num array de dependências de `useEffect` (ex.:
	 * `AuthenticatedLayout`) entraria em loop infinito: `logout()` chama `setCurrentUser`, que
	 * re-renderiza o provider, que recria `logout`, cuja nova referência dispara o efeito nele
	 * de novo — sem nunca convergir.
	 */
	const logout = useCallback(async() => {
		await LocalStorage.logout();
		setCurrentUser({ data: null });
	}, []);

	return (
		<CurrentUserContext.Provider value={{ current_user, setCurrentUser, logout }}>
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
