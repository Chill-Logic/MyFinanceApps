import { NavLink } from 'react-router-dom';

import { ChevronLeft, LogOut, Settings } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';

import Logo from '@/components/atoms/Logo';
import WalletSwitcher from '@/components/organisms/WalletSwitcher';

interface IProps {
	/**
	 * `full`: logo completo, seletor de carteira e rótulos. `rail`: trilho só de ícones. Quem escolhe é
	 * o usuário, pelo botão redondo na borda da barra (`onToggle`); sem escolha, o DefaultTemplate usa
	 * `full` no desktop e `rail` no tablet.
	 */
	variant?: 'full' | 'rail';
	/** Mostra o botão de recolher/expandir na borda da barra. */
	onToggle?: ()=> void;
	className?: string;
}

const initialsOf = (name?: string) => (name || '?')
	.split(/\s+/)
	.filter(Boolean)
	.slice(0, 2)
	.map((part) => part[0]?.toUpperCase())
	.join('');

/*
 * Recolher/expandir ANIMADO: a marcação é a mesma nos dois estados — só a largura da barra anima
 * (`transition-[width]`) e os rótulos somem com `opacity`, cortados pelo `overflow-hidden`. Para os
 * ícones não pularem de lugar, tudo usa um recuo fixo calculado para ficar centrado no trilho:
 * trilho de 84px − 2×16px de padding − 1px da borda = 51px úteis; ícone de 18px → recuo de 17px; avatar de 32px →
 * recuo de 10px; logo (caixa de 40px) → recuo de 6px. Se mudar largura, padding ou tamanhos, refaça
 * essas contas. O logo tem SEMPRE o mesmo tamanho nos dois estados.
 */
const Sidebar = ({ variant = 'full', onToggle, className }: IProps) => {
	const rail = variant === 'rail';

	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { data: data_invites } = useListInvites();

	const invites_count = data_invites?.data.length ?? 0;
	const user_name = current_user.data?.name ?? '';

	const item_class = (active: boolean) => cn(
		'relative flex h-10 w-full shrink-0 items-center gap-3 rounded-xl px-[17px] text-sm font-medium transition-colors',
		active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
	);

	/* Rótulo que some ao recolher (sem desmontar, pra animar junto com a largura). */
	const label_class = cn('flex-1 truncate whitespace-nowrap text-left transition-opacity duration-200', rail ? 'opacity-0' : 'opacity-100 delay-100');

	return (
		<div className={cn('relative flex shrink-0', className)}>
			<aside
				className={cn(
					'flex flex-col overflow-hidden border-r border-border bg-sidebar px-4 py-6 transition-[width] duration-300 ease-out',
					rail ? 'w-[84px]' : 'w-[260px]',
				)}
			>
				<div className='mb-6 flex shrink-0 pl-[6px]'>
					<Logo variant='horizontal' size={32} />
				</div>

				{/*
				 * Bloco rolável (switcher + destinos + Nova Carteira): `flex-1`/`min-h-0` + scroll interno
				 * pra o rodapé (usuário/Sair) ficar sempre ancorado embaixo, mesmo com a lista de carteiras
				 * aberta passando da altura.
				 */}
				<div className='no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden'>
					{/* Seletor de carteira: recolhe a altura (grid 1fr↔0fr) e some junto com a barra */}
					<div className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', rail ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100')}>
						<div className='min-h-0 overflow-hidden'>
							{/* Largura fixa = área útil da barra aberta (260 − 2×16 de padding − 1px da borda), pra o texto não quebrar durante a animação. Mais larga que isso, a borda direita do seletor é cortada. */}
							<div className='mb-4 w-[227px]' aria-hidden={rail}>
								<WalletSwitcher />
							</div>
						</div>
					</div>

					<nav aria-label='Navegação principal' className='flex flex-col gap-1'>
						{navItems.map(({ id, label, path, icon: Icon }) => (
							<NavLink
								key={id}
								to={path}
								end
								title={rail ? label : undefined}
								aria-label={rail ? label : undefined}
								className={({ isActive }) => item_class(isActive)}
							>
								<Icon className='h-[18px] w-[18px] shrink-0' />
								<span className={label_class}>{label}</span>
								{id === 'wallets_invites' && invites_count > 0 && (
									rail
										? <span className='absolute right-2.5 top-2 h-2 w-2 rounded-full bg-primary' />
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
							<newWalletAction.icon className='h-[18px] w-[18px] shrink-0' />
							<span className={label_class}>{newWalletAction.label}</span>
						</button>
					</nav>
				</div>

				{/* Rodapé: usuário (leva às Configurações) + Sair, sempre grudados na base. */}
				<div className='mt-4 flex shrink-0 flex-col gap-1'>
					<NavLink
						to='/settings'
						end
						title={rail ? 'Configurações' : undefined}
						aria-label={rail ? 'Configurações' : undefined}
						className={({ isActive }) => cn(
							'flex h-14 w-full items-center gap-3 rounded-2xl border px-[9px] transition-colors',
							rail ? 'border-transparent' : 'border-border',
							isActive ? 'bg-accent' : 'hover:bg-accent/60',
						)}
					>
						<span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-foreground'>
							{initialsOf(user_name)}
						</span>
						<span className={cn('flex min-w-0 flex-1 flex-col transition-opacity duration-200', rail ? 'opacity-0' : 'opacity-100 delay-100')}>
							<span className='truncate whitespace-nowrap text-sm font-semibold text-foreground'>{user_name || 'Minha conta'}</span>
							<span className='flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground'><Settings className='h-3 w-3' />Configurações</span>
						</span>
					</NavLink>

					<button
						type='button'
						onClick={logout}
						title='Sair'
						aria-label='Sair'
						className='flex h-10 w-full items-center gap-3 rounded-xl px-[17px] text-sm font-medium text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger'
					>
						<LogOut className='h-[18px] w-[18px] shrink-0' />
						<span className={label_class}>Sair</span>
					</button>
				</div>
			</aside>

			{/* Recolher/expandir: botão redondo na borda direita, na altura do logo (fora da `aside`, que corta o que vaza). */}
			{onToggle && (
				<button
					type='button'
					onClick={onToggle}
					title={rail ? 'Expandir menu' : 'Recolher menu'}
					aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
					aria-expanded={!rail}
					className='absolute -right-3.5 top-[34px] z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground'
				>
					<ChevronLeft className={cn('h-4 w-4 transition-transform duration-300', rail && 'rotate-180')} />
				</button>
			)}
		</div>
	);
};

export default Sidebar;
