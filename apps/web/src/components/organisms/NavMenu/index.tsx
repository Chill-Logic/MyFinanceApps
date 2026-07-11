import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { QUERY_KEYS } from '@myfinance/shared';
import { LogOut, RefreshCw, Settings } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

import WalletSwitcher from '@/components/organisms/WalletSwitcher';
import { SheetTitle } from '@/components/ui/sheet';

interface IProps {
	onClose: ()=> void;
}

const item_class = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

/**
 * Corpo do bottom sheet do menu mobile (aberto pelo hambúrguer da `BottomNav`) — equivalente
 * ao `NavMenu` do apps/mobile, e o que substituiu o `Popover` enxuto que existia aqui antes.
 * Reúne header de usuário + refresh, wallet switcher inline (`WalletSwitcher`, compartilhado com
 * o `Sidebar` do desktop), destinos com badge de convites, Nova Carteira, toggle de tema (extra
 * Sair. Aparência (tema) e "Sobre" moram na página de Configurações, não mais no menu.
 */
const NavMenu = ({ onClose }: IProps) => {
	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { data: data_invites } = useListInvites();

	const [ is_refreshing, setIsRefreshing ] = useState(false);

	const invites_count = data_invites?.data.length ?? 0;

	/*
	 * O web não tem `RefreshProvider` como o mobile — o "atualizar" aqui é invalidar todas as
	 * queries do React Query (mesma lógica do `useRefresh({ all: true })` do mobile: percorre os
	 * QUERY_KEYS de cada modelo), com um estado local só pra girar o ícone enquanto roda.
	 */
	const handleRefresh = async() => {
		if (is_refreshing) return;

		setIsRefreshing(true);
		try {
			await Promise.all(
				Object.values(QUERY_KEYS).flatMap((model_keys) =>
					Object.values(model_keys).map((key) =>
						queryClient.invalidateQueries({ queryKey: [ key ] }),
					),
				),
			);
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleNewWallet = () => {
		onClose();
		newWalletAction.onClick();
	};

	const handleLogout = () => {
		onClose();
		logout();
	};

	return (
		<div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border scrollbar-thumb-rounded-full'>
			<SheetTitle className='sr-only'>Menu de navegação</SheetTitle>

			<div className='flex items-center gap-3 px-3 py-2'>
				<div className='min-w-0 flex-1'>
					<p className='truncate text-sm font-bold text-foreground'>{current_user.data?.name}</p>
					<p className='truncate text-xs text-muted-foreground'>{current_user.data?.email}</p>
				</div>
				<button
					type='button'
					onClick={handleRefresh}
					disabled={is_refreshing}
					aria-label='Atualizar dados'
					className='rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-60'
				>
					<RefreshCw className={cn('h-4 w-4', is_refreshing && 'animate-spin')} />
				</button>
			</div>

			<div className='my-2 border-t border-border' />

			<WalletSwitcher onAfterSelect={onClose} />

			<div className='my-2 border-t border-border' />

			{navItems.map(({ id, label, path, icon: Icon }) => (
				<NavLink
					key={id}
					to={path}
					end
					onClick={onClose}
					className={({ isActive }) => cn(item_class, isActive && 'bg-secondary text-secondary-foreground')}
				>
					<Icon className='h-4 w-4 shrink-0' />
					<span className='flex-1'>{label}</span>
					{id === 'wallets_invites' && invites_count > 0 && (
						<span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-secondary px-1 text-xs font-bold text-white'>
							{invites_count}
						</span>
					)}
				</NavLink>
			))}

			<button type='button' onClick={handleNewWallet} className={item_class}>
				<newWalletAction.icon className='h-4 w-4 shrink-0' />
				{newWalletAction.label}
			</button>

			<div className='my-2 border-t border-border' />

			<NavLink
				to='/settings'
				end
				onClick={onClose}
				className={({ isActive }) => cn(item_class, isActive && 'bg-secondary text-secondary-foreground')}
			>
				<Settings className='h-4 w-4 shrink-0' />
				Configurações
			</NavLink>

			<button type='button' onClick={handleLogout} className={cn(item_class, 'text-destructive hover:text-destructive')}>
				<LogOut className='h-4 w-4 shrink-0' />
				Sair
			</button>
		</div>
	);
};

export default NavMenu;
