import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

import useShowCurrentUser from '@/hooks/api/user/useShowCurrentUser';

import { AuthStorage } from '@/services/storage';

import { TUser } from '@/types';

export type TCurrentUserState = {
	data: TUser | null;
};

interface IContextType {
	current_user: TCurrentUserState;
	setCurrentUser: Dispatch<SetStateAction<TCurrentUserState>>;
	logout: ()=> void;
	is_loading: boolean;
}

const initialValue: IContextType = {
	current_user: { data: null },
	setCurrentUser: () => {},
	logout: () => {},
	is_loading: false,
};

const CurrentUserContext = createContext(initialValue);

export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
	const [ current_user, setCurrentUser ] = useState<TCurrentUserState>({ data: null });
	const { data: current_user_data, isError, isFetched } = useShowCurrentUser({ enabled: Boolean(AuthStorage.getToken()) });

	/*
	 * Enquanto existe token mas ainda não temos usuário nem resposta definitiva (sucesso ou erro) da
	 * busca, estamos "carregando" — sem isso, quem consome o contexto não tem como distinguir "ainda
	 * carregando" de "não tem usuário mesmo".
	 */
	const is_loading = Boolean(AuthStorage.getToken()) && !current_user.data && !isFetched;

	useEffect(() => {
		if (current_user_data) {
			setCurrentUser({ data: current_user_data });
		}
	}, [ current_user_data ]);

	useEffect(() => {
		if (isError) {
			AuthStorage.clearToken();
			setCurrentUser({ data: null });
		}
	}, [ isError ]);

	const logout = () => {
		AuthStorage.clearToken();
		setCurrentUser({ data: null });
	};

	return (
		<CurrentUserContext.Provider value={{ current_user, setCurrentUser, logout, is_loading }}>
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
