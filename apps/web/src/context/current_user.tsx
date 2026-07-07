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
}

const initialValue: IContextType = {
	current_user: { data: null },
	setCurrentUser: () => {},
	logout: () => {},
};

const CurrentUserContext = createContext(initialValue);

export const CurrentUserProvider = ({ children }: { children: ReactNode }) => {
	const [ current_user, setCurrentUser ] = useState<TCurrentUserState>({ data: null });
	const { data: current_user_data, isError } = useShowCurrentUser({ enabled: Boolean(AuthStorage.getToken()) });

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
