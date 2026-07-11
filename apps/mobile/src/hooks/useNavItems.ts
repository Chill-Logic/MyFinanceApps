import { useMemo } from 'react';

import { useNavigationState } from '@react-navigation/native';

import { useNewTransactionDialog } from '../context/newTransactionDialog';

export type TNavItem = {
	id: string;
	label: string;
	route: string;
	icon: string;
};

export type TNavAction = {
	id: string;
	label: string;
	icon: string;
	onClick: ()=> void;
};

/**
 * Mesma FORMA do equivalente em apps/web (3 destinos fixos + ação central sensível a rota) —
 * só a leitura da rota atual muda: lá é useLocation() do react-router-dom, aqui é
 * useNavigationState() do React Navigation. "Nova Carteira" não foi portado pra cá porque no
 * mobile ela já existe, implementada de verdade (via WalletFormModal a partir do Sidebar),
 * diferente do placeholder ("Em breve") que o web ainda tem.
 */
const NAV_ITEMS: TNavItem[] = [
	{ id: 'home', label: 'Início', route: 'Home', icon: 'home' },
	{ id: 'my_wallets', label: 'Carteiras', route: 'MyWallets', icon: 'wallet' },
	{ id: 'wallets_invites', label: 'Convites', route: 'WalletsInvites', icon: 'group-add' },
];

export const useNavItems = () => {
	const current_route_name = useNavigationState((state) => state?.routes[state.index]?.name);
	const { setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	/**
	 * Só existe na Home, que é sempre a visão da carteira selecionada no contexto
	 * (useWallet()) — em qualquer outra tela não faz sentido um "+" em destaque.
	 *
	 * `useMemo` aqui não é só otimização: sem ele, esse objeto nasce de novo a cada render, e
	 * o `useEffect` da `BottomNav` que depende de `centerAction` (pra animar o FAB) nunca via
	 * a dependência como "igual" de um render pro outro — disparava de novo, chamava
	 * `setState`, causava outro render, criava outro objeto novo, disparava de novo... loop
	 * infinito ("Maximum update depth exceeded"). Memoizado por `current_route_name`, a
	 * referência só muda quando a rota realmente muda.
	 */
	const centerAction = useMemo<TNavAction | null>(() => (
		current_route_name === 'Home'
			? {
				id: 'new_transaction',
				label: 'Nova Transação',
				icon: 'add',
				onClick: () => setIsNewTransactionOpen(true),
			}
			: null
	), [ current_route_name, setIsNewTransactionOpen ]);

	return { navItems: NAV_ITEMS, currentRouteName: current_route_name, centerAction };
};

export default useNavItems;
