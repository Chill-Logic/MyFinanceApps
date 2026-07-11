import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { ChevronLeft, ChevronRight, Info, LogOut, Moon, Settings, Sun } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

import AboutInfo from '@/components/organisms/AboutInfo';
import WalletSwitcher from '@/components/organisms/WalletSwitcher';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	className?: string;
}

const item_class = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

const Sidebar = ({ className }: IProps) => {
	const [ collapsed, setCollapsed ] = useState(false);

	const { navItems, newWalletAction } = useNavItems();
	const { logout } = useCurrentUserContext();
	const { theme, toggleTheme } = useTheme();
	const { data: data_invites } = useListInvites();

	const invites_count = data_invites?.data.length ?? 0;

	return (
		<aside
			className={cn(
				'relative flex flex-col border-r border-border bg-background p-3 transition-all duration-300',
				collapsed ? 'w-16' : 'w-64',
				className,
			)}
		>
			{/*
			 * Bloco de topo rolável (switcher + destinos + Nova Carteira). `flex-1`/`min-h-0` +
			 * scroll interno pra o rodapé (tema/Sair) ficar sempre ancorado embaixo, mesmo se a
			 * lista de carteiras expandida passar da altura. Scrollbar estilizada igual ao NavMenu.
			 */}
			<div className='flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border scrollbar-thumb-rounded-full'>
				{!collapsed && (
					<>
						<WalletSwitcher />
						<div className='my-2 border-t border-border' />
					</>
				)}

				{navItems.map(({ id, label, path, icon: Icon }) => (
					<NavLink
						key={id}
						to={path}
						end
						title={collapsed ? label : undefined}
						className={({ isActive }) => cn(item_class, collapsed && 'justify-center', isActive && 'bg-secondary text-secondary-foreground')}
					>
						<span className='relative shrink-0'>
							<Icon className='h-4 w-4' />
							{collapsed && id === 'wallets_invites' && invites_count > 0 && (
								<span className='absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-secondary' />
							)}
						</span>
						{!collapsed && <span className='flex-1'>{label}</span>}
						{!collapsed && id === 'wallets_invites' && invites_count > 0 && (
							<span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-secondary px-1 text-xs font-bold text-white'>
								{invites_count}
							</span>
						)}
					</NavLink>
				))}

				<button
					type='button'
					onClick={newWalletAction.onClick}
					title={collapsed ? newWalletAction.label : undefined}
					className={cn(item_class, collapsed && 'justify-center')}
				>
					<newWalletAction.icon className='h-4 w-4 shrink-0' />
					{!collapsed && newWalletAction.label}
				</button>
			</div>

			{/* Rodapé isolado: Configurações + tema + Sair, sempre grudados na base do menu. */}
			<div className='flex shrink-0 flex-col gap-1'>
				<div className='my-2 border-t border-border' />

				<NavLink
					to='/wallets/settings'
					end
					title={collapsed ? 'Configurações' : undefined}
					className={({ isActive }) => cn(item_class, collapsed && 'justify-center', isActive && 'bg-secondary text-secondary-foreground')}
				>
					<Settings className='h-4 w-4 shrink-0' />
					{!collapsed && 'Configurações'}
				</NavLink>

				<Popover>
					<PopoverTrigger asChild>
						<button
							type='button'
							title={collapsed ? 'Sobre' : undefined}
							className={cn(item_class, collapsed && 'justify-center')}
						>
							<Info className='h-4 w-4 shrink-0' />
							{!collapsed && 'Sobre'}
						</button>
					</PopoverTrigger>
					<PopoverContent side='right' align='end' className='w-60'>
						<p className='mb-1.5 text-sm font-medium text-foreground'>Sobre</p>
						<AboutInfo />
					</PopoverContent>
				</Popover>

				<button
					type='button'
					onClick={toggleTheme}
					title={collapsed ? 'Alternar tema' : undefined}
					className={cn(item_class, collapsed && 'justify-center')}
				>
					{theme === 'dark' ? <Sun className='h-4 w-4 shrink-0' /> : <Moon className='h-4 w-4 shrink-0' />}
					{!collapsed && 'Alternar tema'}
				</button>

				<button
					type='button'
					onClick={logout}
					title={collapsed ? 'Sair' : undefined}
					className={cn(item_class, 'text-destructive hover:text-destructive', collapsed && 'justify-center')}
				>
					<LogOut className='h-4 w-4 shrink-0' />
					{!collapsed && 'Sair'}
				</button>
			</div>

			{/*
			 * Botão de colapsar estilo FAB: circular, saltando pra fora da borda direita
			 * (`translate-x-1/2` sobre `right-0`) com sombra — mesma linguagem do FAB da BottomNav.
			 * Ancorado perto do topo (`top-[60px]`), não no meio da sidebar. `z-10` pra ficar acima
			 * do conteúdo da página (irmão posterior no DOM).
			 */}
			<button
				type='button'
				onClick={() => setCollapsed((prev) => !prev)}
				aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
				className='absolute right-0 top-[60px] z-10 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105'
			>
				{collapsed ? <ChevronRight className='h-4 w-4' /> : <ChevronLeft className='h-4 w-4' />}
			</button>
		</aside>
	);
};

export default Sidebar;
