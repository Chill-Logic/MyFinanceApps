import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { Mail, Plus, Wallet as WalletIcon, Home, type LucideIcon } from 'lucide-react';

import useToast from '@/hooks/useToast';

import { useNewTransactionDialog } from '@/context/newTransactionDialog';

export type TNavItem = {
	id: string;
	label: string;
	path: string;
	icon: LucideIcon;
};

export type TNavAction = {
	id: string;
	label: string;
	icon: LucideIcon;
	onClick: ()=> void;
};

/**
 * Acessos rápidos de navegação (viram links de verdade). Isso é o que precisa de um
 * equivalente ao portar essa navegação pro mobile (lá, provavelmente lidos de dentro de
 * um hook que usa `useRoute()`/`useNavigationState()` do React Navigation em vez de
 * `useLocation()` do react-router-dom) — a FORMA (3 destinos fixos) é a parte que deve
 * ser igual nas duas plataformas, só a leitura da rota atual muda.
 */
const NAV_ITEMS: TNavItem[] = [
	{ id: 'home', label: 'Início', path: '/', icon: Home },
	{ id: 'wallets_invites', label: 'Convites', path: '/wallets/invites', icon: Mail },
	{ id: 'my_wallets', label: 'Carteiras', path: '/wallets', icon: WalletIcon },
];

export const useNavItems = () => {
	const { pathname } = useLocation();
	const { toast } = useToast();
	const { setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	/**
	 * "Nova Carteira" não é sensível a rota — sempre acessível (menu + dentro da própria
	 * tela de Carteiras), diferente da ação central abaixo.
	 *
	 * Memoizado (assim como `centerAction`) porque o `BottomNav` tem um `useEffect` que depende
	 * de `centerAction` — sem referência estável, o objeto novo a cada render fazia o efeito
	 * rodar em loop infinito ("Maximum update depth exceeded"). `toast` e `setIsNewTransactionOpen`
	 * são referências estáveis (import do sonner / setter de `useState`), seguras como deps.
	 */
	const newWalletAction = useMemo<TNavAction>(() => ({
		id: 'new_wallet',
		label: 'Nova Carteira',
		icon: Plus,
		onClick: () => toast.info('Em breve'),
	}), [ toast ]);

	/**
	 * Ação central da bottom nav (só mobile — no desktop o Sidebar não usa isso, é lista
	 * simples). Só existe na Início, que é sempre a visão da carteira selecionada no
	 * contexto (`useWallet()`, ainda não implementado no web) — em qualquer outra tela não
	 * faz sentido um "+" em destaque, então o valor é `null` e quem renderiza decide não
	 * mostrar nada no lugar.
	 */
	const centerAction = useMemo<TNavAction | null>(() => (
		pathname === '/'
			? {
				id: 'new_transaction',
				label: 'Nova Transação',
				icon: Plus,
				onClick: () => setIsNewTransactionOpen(true),
			}
			: null
	), [ pathname, setIsNewTransactionOpen ]);

	return { navItems: NAV_ITEMS, newWalletAction, centerAction };
};

export default useNavItems;
