import { NavLink } from 'react-router-dom';

import { LogOut, Settings } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';

import Logo from '@/components/atoms/Logo';
import WalletSwitcher from '@/components/organisms/WalletSwitcher';

interface IProps {
	/**
	 * `full` no desktop (≥1280px): logo completo, seletor de carteira e rótulos. `rail` no tablet
	 * (768–1279px): trilho só de ícones. Quem decide é o DefaultTemplate pelo tamanho da tela — não
	 * existe mais o botão manual de recolher.
	 */
	variant?: 'full' | 'rail';
	className?: string;
}

const initialsOf = (name?: string) => (name || '?')
	.split(/\s+/)
	.filter(Boolean)
	.slice(0, 2)
	.map((part) => part[0]?.toUpperCase())
	.join('');

const Sidebar = ({ variant = 'full', className }: IProps) => {
	const rail = variant === 'rail';

	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { data: data_invites } = useListInvites();

	const invites_count = data_invites?.data.length ?? 0;
	const user_name = current_user.data?.name ?? '';

	const item_class = (active: boolean) => cn(
		'relative flex items-center rounded-xl text-sm font-medium transition-colors',
		rail ? 'h-12 w-12 justify-center' : 'h-10 w-full gap-3 px-3',
		active ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
	);

	return (
		<aside
			className={cn(
				'flex shrink-0 flex-col border-r border-border bg-sidebar',
				rail ? 'w-[84px] items-center px-0 py-5' : 'w-[260px] px-4 py-6',
				className,
			)}
		>
			<div className={cn('flex shrink-0', rail ? 'mb-5 justify-center' : 'mb-6 px-2')}>
				<Logo variant={rail ? 'icon' : 'horizontal'} size={rail ? 40 : 32} />
			</div>

			{/*
			 * Bloco rolável (switcher + destinos + Nova Carteira): `flex-1`/`min-h-0` + scroll interno
			 * pra o rodapé (usuário/Sair) ficar sempre ancorado embaixo, mesmo com a lista de carteiras
			 * aberta passando da altura.
			 */}
			<div className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto', rail && 'items-center')}>
				{!rail && (
					<div className='mb-4'>
						<WalletSwitcher />
					</div>
				)}

				<nav aria-label='Navegação principal' className={cn('flex flex-col gap-1', rail && 'items-center')}>
					{navItems.map(({ id, label, path, icon: Icon }) => (
						<NavLink
							key={id}
							to={path}
							end
							title={rail ? label : undefined}
							aria-label={rail ? label : undefined}
							className={({ isActive }) => item_class(isActive)}
						>
							<Icon className={cn('shrink-0', rail ? 'h-5 w-5' : 'h-[18px] w-[18px]')} />
							{!rail && <span className='flex-1 truncate'>{label}</span>}
							{id === 'wallets_invites' && invites_count > 0 && (
								rail
									? <span className='absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary' />
									: (
										<span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground'>
											{invites_count}
										</span>
									)
							)}
						</NavLink>
					))}

					<button
						type='button'
						onClick={newWalletAction.onClick}
						title={rail ? newWalletAction.label : undefined}
						aria-label={rail ? newWalletAction.label : undefined}
						className={item_class(false)}
					>
						<newWalletAction.icon className={cn('shrink-0', rail ? 'h-5 w-5' : 'h-[18px] w-[18px]')} />
						{!rail && newWalletAction.label}
					</button>
				</nav>
			</div>

			{/* Rodapé: usuário (leva às Configurações) + Sair, sempre grudados na base. */}
			<div className={cn('mt-4 flex shrink-0', rail ? 'flex-col items-center gap-2' : 'items-center gap-1')}>
				<NavLink
					to='/settings'
					end
					title={rail ? 'Configurações' : undefined}
					aria-label={rail ? 'Configurações' : undefined}
					className={({ isActive }) => cn(
						'flex min-w-0 items-center rounded-2xl transition-colors',
						rail ? 'h-12 w-12 justify-center' : 'flex-1 gap-3 border border-border p-2.5',
						isActive ? 'bg-accent' : 'hover:bg-accent/60',
					)}
				>
					<span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-foreground'>
						{initialsOf(user_name)}
					</span>
					{!rail && (
						<span className='flex min-w-0 flex-1 flex-col'>
							<span className='truncate text-sm font-semibold text-foreground'>{user_name || 'Minha conta'}</span>
							<span className='flex items-center gap-1 text-xs text-muted-foreground'><Settings className='h-3 w-3' />Configurações</span>
						</span>
					)}
				</NavLink>

				<button
					type='button'
					onClick={logout}
					title='Sair'
					aria-label='Sair'
					className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger'
				>
					<LogOut className='h-[18px] w-[18px]' />
				</button>
			</div>
		</aside>
	);
};

export default Sidebar;
