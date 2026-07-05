import { createContext, Dispatch, useContext, useState, SetStateAction, useEffect } from 'react';

import { useGetMainWallet } from '../hooks/api/wallets/useGetMainWallet';

import { LocalStorage } from '../services/storage';

import { TWallet } from '../types/models';
import { StorageKeys } from '../types/storage';

import { useCurrentUserContext } from './current_user';

export type TWalletState = {
	data: TWallet | null;
}

interface ContextType {
	user_wallet: TWalletState;
	setUserWallet: Dispatch<SetStateAction<TWalletState>>;
	setCanSearchForWallets: Dispatch<SetStateAction<boolean>>;
}

const initialValue: ContextType = {
	user_wallet: {
		data: null,
	},
	setUserWallet: () => {},
	setCanSearchForWallets: () => {},
};

const WalletUserContext = createContext(initialValue);

export const WalletUserProvider = ({ children }: { children: React.ReactNode }) => {
	const { current_user } = useCurrentUserContext();
	const [ can_search_for_wallets, setCanSearchForWallets ] = useState(false);
	const [ user_wallet, setUserWallet ] = useState<TWalletState>({
		data: null,
	});

	const { data: main_wallet } = useGetMainWallet({
		enabled: can_search_for_wallets && Boolean(current_user.data?.id),
		params: {
			user_id: current_user.data?.id || '',
		},
	});

	useEffect(() => {
		(async() => {
			const token = await LocalStorage.getItem(StorageKeys.TOKEN);
			if ((token) && !user_wallet.data) {
				setCanSearchForWallets(true);
			}
		})();
	}, [ user_wallet.data, current_user.data ]);

	useEffect(() => {
		if (main_wallet) {
			setUserWallet({ data: main_wallet });
		}
	}, [ main_wallet ]);

	return (
		<WalletUserContext.Provider
			value={{
				user_wallet,
				setUserWallet,
				setCanSearchForWallets,
			}}
		>
			{children}
		</WalletUserContext.Provider>
	);
};

export const useWallet = () => {
	const context = useContext(WalletUserContext);
	if (!context) {
		throw new Error('useWallet must be used within an WalletUserProvider');
	}
	return context;
};

export default WalletUserProvider;
