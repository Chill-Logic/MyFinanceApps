import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { QUERY_KEYS } from '@myfinance/shared';
import { Info, LogOut, Moon, RefreshCw, Settings, Sun } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

import AboutInfo from '@/components/organisms/AboutInfo';
import WalletSwitcher from '@/components/organisms/WalletSwitcher';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
 * do web — o mobile não tem light/dark) e Sair, com a versão no rodapé.
 */
const NavMenu = ({ onClose }: IProps) => {
	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { theme, toggleTheme } = useTheme();
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
				to='/wallets/settings'
				end
				onClick={onClose}
				className={({ isActive }) => cn(item_class, isActive && 'bg-secondary text-secondary-foreground')}
			>
				<Settings className='h-4 w-4 shrink-0' />
				Configurações
			</NavLink>

			<button type='button' onClick={toggleTheme} className={item_class}>
				{theme === 'dark' ? <Sun className='h-4 w-4 shrink-0' /> : <Moon className='h-4 w-4 shrink-0' />}
				Alternar tema
			</button>

			<button type='button' onClick={handleLogout} className={cn(item_class, 'text-destructive hover:text-destructive')}>
				<LogOut className='h-4 w-4 shrink-0' />
				Sair
			</button>

			{/* "Sobre" ancorado no rodapé (`mt-auto`): ícone "i" + label que abre um popover com as
			    versões (app + branch/commit/data da API). Popover (clique/toque) em vez de tooltip
			    por hover, que não abre no touch do bottom sheet. */}
			<div className='mt-auto flex justify-center pt-4'>
				<Popover>
					<PopoverTrigger asChild>
						<button type='button' className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'>
							<Info className='h-4 w-4' />
							Sobre
						</button>
					</PopoverTrigger>
					<PopoverContent side='top' align='center' className='w-60'>
						<p className='mb-1.5 text-sm font-medium text-foreground'>Sobre</p>
						<AboutInfo />
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
};

export default NavMenu;
