import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

import { useGetMainWallet } from '@/hooks/api/wallets/useGetMainWallet';

import { useCurrentUserContext } from '@/context/current_user';
import { AuthStorage } from '@/services/storage';

import { TWallet } from '@/types';

export type TWalletState = {
	data: TWallet | null;
};

interface IContextType {
	user_wallet: TWalletState;
	setUserWallet: Dispatch<SetStateAction<TWalletState>>;
	setCanSearchForWallets: Dispatch<SetStateAction<boolean>>;
	is_loading: boolean;
}

const initialValue: IContextType = {
	user_wallet: { data: null },
	setUserWallet: () => {},
	setCanSearchForWallets: () => {},
	is_loading: false,
};

const WalletUserContext = createContext(initialValue);

export const WalletUserProvider = ({ children }: { children: ReactNode }) => {
	const { current_user, is_loading: is_current_user_loading } = useCurrentUserContext();
	const [ can_search_for_wallets, setCanSearchForWallets ] = useState(false);
	const [ user_wallet, setUserWallet ] = useState<TWalletState>({ data: null });

	const { data: main_wallet, isFetched: is_wallet_fetched } = useGetMainWallet({
		enabled: can_search_for_wallets && Boolean(current_user.data?.id),
		params: { user_id: current_user.data?.id || '' },
	});

	/*
	 * "Carregando" cobre duas fases: esperar o usuário atual (pré-requisito pra nem poder buscar a
	 * carteira ainda) e esperar a própria busca da carteira terminar (sucesso ou erro, `isFetched`
	 * evita loading infinito se o usuário legitimamente não tiver carteira nenhuma).
	 */
	const is_loading = Boolean(AuthStorage.getToken()) && !user_wallet.data && (is_current_user_loading || !is_wallet_fetched);

	useEffect(() => {
		if (AuthStorage.getToken() && !user_wallet.data) {
			setCanSearchForWallets(true);
		}
	}, [ user_wallet.data, current_user.data ]);

	useEffect(() => {
		if (main_wallet) {
			setUserWallet({ data: main_wallet });
		}
	}, [ main_wallet ]);

	return (
		<WalletUserContext.Provider value={{ user_wallet, setUserWallet, setCanSearchForWallets, is_loading }}>
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
