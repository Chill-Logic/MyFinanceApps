import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { CreditCard, Mail, Plus, Wallet as WalletIcon, Home, type LucideIcon } from 'lucide-react';

import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useNewWalletDialog } from '@/context/newWalletDialog';
import { usePrimaryActionState } from '@/context/primaryAction';

export type TNavItem = {
	id: string;
	label: string;
	/** Rótulo curto pra bottom nav (onde o espaço é apertado). Cai pra `label` se ausente. */
	short?: string;
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
	{ id: 'finances', label: 'Contas & Cartões', short: 'Contas', path: '/contas', icon: CreditCard },
	{ id: 'my_wallets', label: 'Carteiras', path: '/carteiras', icon: WalletIcon },
	{ id: 'wallets_invites', label: 'Convites', path: '/carteiras/convites', icon: Mail },
];

/*
 * Subconjunto exibido na bottom nav do mobile (só 3 cabem ao lado do FAB + hambúrguer).
 * "Convites" fica de fora aqui — vive no menu do hambúrguer (NavMenu), onde já aparece com badge.
 */
const BOTTOM_NAV_IDS = [ 'home', 'finances', 'my_wallets' ];

export const useNavItems = () => {
	const { pathname } = useLocation();
	const { setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();
	const { setIsOpen: setIsNewWalletOpen } = useNewWalletDialog();
	const { action: page_action } = usePrimaryActionState();

	/**
	 * "Nova Carteira" não é sensível a rota — sempre acessível (menu + dentro da própria
	 * tela de Carteiras), diferente da ação central abaixo. Abre o WalletFormDialog (montado no
	 * DefaultTemplate) via contexto.
	 *
	 * Memoizado (assim como `centerAction`) porque o `BottomNav` tem um `useEffect` que depende
	 * de `centerAction` — sem referência estável, o objeto novo a cada render fazia o efeito
	 * rodar em loop infinito ("Maximum update depth exceeded"). Os setters de `useState` são
	 * referências estáveis, seguras como deps.
	 */
	const newWalletAction = useMemo<TNavAction>(() => ({
		id: 'new_wallet',
		label: 'Nova Carteira',
		icon: Plus,
		onClick: () => setIsNewWalletOpen(true),
	}), [ setIsNewWalletOpen ]);

	/**
	 * Ação central da bottom nav (só celular): o "+" com a ação principal da tela. Cada tela/aba registra a
	 * sua com `usePrimaryAction` (context/primaryAction); sem registro, a Início cai na nova transação e as
	 * outras ficam `null` (a barra encolhe o slot do "+").
	 */
	const centerAction = useMemo<TNavAction | null>(() => {
		/* A tela registrou a sua ação principal (context/primaryAction): ela vale. */
		if (page_action) return { id: `page:${ page_action.label }`, label: page_action.label, icon: Plus, onClick: page_action.onClick };
		if (pathname === '/') {
			return { id: 'new_transaction', label: 'Nova Transação', icon: Plus, onClick: () => setIsNewTransactionOpen(true) };
		}
		return null;
	}, [ pathname, setIsNewTransactionOpen, page_action ]);

	const bottomNavItems = NAV_ITEMS.filter((item) => BOTTOM_NAV_IDS.includes(item.id));

	return { navItems: NAV_ITEMS, bottomNavItems, newWalletAction, centerAction };
};

export default useNavItems;
