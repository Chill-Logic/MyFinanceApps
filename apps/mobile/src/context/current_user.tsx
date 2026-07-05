import { createContext, Dispatch, useContext, useState, SetStateAction } from 'react';

import { TUser } from '../types/models';

export type TCurrentUserState = {
	data: TUser | null;
}

interface ContextType {
	current_user: TCurrentUserState;
	setCurrentUser: Dispatch<SetStateAction<TCurrentUserState>>;
}

const initialValue: ContextType = {
	current_user: {
		data: null,
	},
	setCurrentUser: () => {},
};

const CurrentUserContext = createContext(initialValue);

export const CurrentUserProvider = ({ children }: { children: React.ReactNode }) => {
	const [ current_user, setCurrentUser ] = useState<TCurrentUserState>({
		data: null,
	});

	return (
		<CurrentUserContext.Provider
			value={{
				current_user,
				setCurrentUser,
			}}
		>
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
