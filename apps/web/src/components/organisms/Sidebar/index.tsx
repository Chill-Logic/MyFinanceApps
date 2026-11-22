import { useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { ChevronLeft, ChevronsUpDown, ChevronUp, LogOut, Plus, RefreshCw, Settings } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';

import Logo from '@/components/atoms/Logo';
import {
	GLASS_PANEL,
	GLASS_TILE,
	LiquidBlob,
	ThemeSwitch,
	useLiquidBlob,
	useRefreshAll,
	useWalletChoices,
	WalletAvatar,
	walletMoney,
	WalletPanel,
} from '@/components/molecules/NavKit';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	/**
	 * `full`: barra lateral (desktop). `rail`: trilho de ícones (tablets). Quem escolhe é o usuário, pelo botão
	 * redondo na borda (`onToggle`); sem escolha, o DefaultTemplate usa `full` no desktop e `rail` no tablet.
	 */
	variant?: 'full' | 'rail';
	onToggle?: ()=> void;
	className?: string;
}

const initials = (name?: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

/*
 * Barra lateral / trilho (redesign 2026-11, mockup v3 "Menu"): painel de VIDRO flutuante (afastado da borda,
 * cantos de 30px). O item ativo é marcado pela gota, que escorre na vertical entre os itens. No alto, a carteira em
 * foco (cartão com nome e saldo na barra; avatar no trilho) abre o painel de troca de carteira. No rodapé, o perfil
 * abre um menu com Configurações, Atualizar dados, Tema e Sair.
 *
 * Recolher/expandir ANIMADO: só a largura muda (`transition-[width]`) e os rótulos somem com `opacity`. Os ícones não
 * pulam porque o recuo é fixo e centrado no trilho: 76px − 2×12px de padding − 2px de borda = 50px úteis; ícone de
 * 18px → recuo de 16px. Mudou largura/padding? Refaça a conta.
 */
const Sidebar = ({ variant = 'full', onToggle, className }: IProps) => {
	const rail = variant === 'rail';
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { data: data_invites } = useListInvites();
	const { active, active_index } = useWalletChoices();
	const { refresh, is_refreshing } = useRefreshAll();

	const [ wallet_open, setWalletOpen ] = useState(false);
	const [ profile_open, setProfileOpen ] = useState(false);

	const invites_count = (data_invites?.data ?? []).filter((invite) => !invite.accepted).length;
	const user_name = current_user.data?.name ?? '';

	const nav_ref = useRef<HTMLElement>(null);
	const active_nav = navItems.find((item) => item.path === pathname)?.id ?? null;
	const blob = useLiquidBlob(`${ active_nav }:${ variant }`, () => (active_nav ? nav_ref.current?.querySelector<HTMLElement>(`[data-nav="${ active_nav }"]`) ?? null : null));

	const label_class = cn('min-w-0 flex-1 truncate whitespace-nowrap text-left transition-opacity duration-200', rail ? 'opacity-0' : 'opacity-100 delay-100');

	const walletTrigger = rail
		? (
			<button type='button' title={active?.name} aria-label={`Carteira: ${ active?.name ?? '' } — trocar`} className='group pressable relative ml-[7px] flex size-9 items-center justify-center'>
				<WalletAvatar name={active?.name ?? '?'} index={active_index} className='size-9 rounded-2xl ring-2 ring-primary/40' />
				<span className='absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-background shadow'><ChevronsUpDown className='size-2.5' /></span>
			</button>
		)
		: (
			<button type='button' className={cn('pressable flex w-[234px] flex-col gap-2 rounded-[22px] p-3 text-left', GLASS_TILE)}>
				<span className='flex items-center gap-2.5'>
					<WalletAvatar name={active?.name ?? '?'} index={active_index} className='size-8' />
					<span className='flex min-w-0 flex-1 flex-col leading-tight'>
						<span className='text-[11px] text-muted-foreground'>Carteira</span>
						<span className='truncate text-sm font-bold'>{active?.name ?? 'Escolha uma carteira'}</span>
					</span>
					<ChevronsUpDown className='size-4 shrink-0 text-muted-foreground' />
				</span>
				{active && <span className={cn('text-lg font-bold tracking-[-0.02em]', active.total < 0 && 'text-destructive')}>{walletMoney(active.total)}</span>}
			</button>
		);

	const profileMenu = (
		<div className='flex flex-col gap-1'>
			<button type='button' onClick={() => { setProfileOpen(false); navigate('/settings'); }} className='pressable flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold hover:bg-white/30 dark:hover:bg-white/[0.05]'>
				<Settings className='size-4' />Configurações
			</button>
			<button type='button' onClick={refresh} disabled={is_refreshing} className='pressable flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold hover:bg-white/30 disabled:opacity-60 dark:hover:bg-white/[0.05]'>
				<RefreshCw className={cn('size-4', is_refreshing && 'animate-spin')} />Atualizar dados
			</button>
			<div className='flex h-11 items-center gap-3 px-3 text-sm font-semibold'>
				<span className='flex-1'>Tema</span>
				<ThemeSwitch />
			</div>
			<div className='my-1 border-t border-foreground/10' />
			<button type='button' onClick={() => { setProfileOpen(false); logout(); }} className='pressable flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-destructive hover:bg-danger-soft'>
				<LogOut className='size-4' />Sair
			</button>
		</div>
	);

	return (
		<div className={cn('relative z-20 flex shrink-0 py-3 pl-3', className)}>
			<aside className={cn('relative flex flex-col overflow-hidden rounded-[30px] px-3 py-4 transition-[width] duration-300 ease-out', GLASS_PANEL, rail ? 'w-[76px]' : 'w-[260px]')}>
				{/* Topo: logo (barra) e a carteira em foco */}
				<div className={cn('flex shrink-0 flex-col gap-3', rail ? 'items-start' : '')}>
					{!rail && <div className='pl-1.5 pt-1'><Logo variant='horizontal' size={30} /></div>}
					<Popover open={wallet_open} onOpenChange={setWalletOpen}>
						<PopoverTrigger asChild>{walletTrigger}</PopoverTrigger>
						<PopoverContent side={rail ? 'right' : 'bottom'} align='start' sideOffset={rail ? 18 : 8} className={cn('w-[340px] overflow-x-hidden rounded-[26px] p-3', GLASS_PANEL)}>
							<WalletPanel onDone={() => setWalletOpen(false)} onNewWallet={newWalletAction.onClick} />
						</PopoverContent>
					</Popover>
				</div>

				<div className='my-3 h-px shrink-0 bg-foreground/10' />

				<div className='no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden'>
					{!rail && <span className='px-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>Navegar</span>}
					<nav ref={nav_ref} aria-label='Navegação principal' className='relative flex flex-col gap-1'>
						<LiquidBlob blob={blob} className='rounded-2xl' />
						{navItems.map(({ id, label, path, icon: Icon }) => (
							<NavLink
								key={id}
								to={path}
								end
								data-nav={id}
								aria-label={rail ? label : undefined}
								title={rail ? label : undefined}
								className={({ isActive }) => cn(
									'group pressable relative z-10 flex h-11 w-full shrink-0 items-center gap-3 rounded-2xl pl-[16px] pr-3 text-sm font-medium transition-colors',
									isActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
								)}
							>
								<Icon className='size-[18px] shrink-0' />
								<span className={label_class}>{label}</span>
								{id === 'wallets_invites' && invites_count > 0 && (
									rail
										? <span className='absolute right-2.5 top-2 size-2 rounded-full bg-primary' />
										: <span className='flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground'>{invites_count}</span>
								)}
							</NavLink>
						))}

						<button
							type='button'
							onClick={newWalletAction.onClick}
							aria-label={rail ? newWalletAction.label : undefined}
							title={rail ? newWalletAction.label : undefined}
							className='group pressable relative z-10 mt-2 flex h-11 w-full items-center gap-3 rounded-2xl border border-dashed border-foreground/20 pl-[15px] pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
						>
							<Plus className='size-[18px] shrink-0' />
							<span className={label_class}>Nova carteira</span>
						</button>
					</nav>
				</div>

				{/* Rodapé: perfil (abre o menu) e, no trilho, Sair à mão */}
				<div className='mt-3 flex shrink-0 flex-col gap-1'>
					<Popover open={profile_open} onOpenChange={setProfileOpen}>
						<PopoverTrigger asChild>
							<button
								type='button'
								aria-label='Menu do perfil'
								className={cn('group pressable relative flex h-14 w-full items-center gap-3 rounded-2xl px-[7px] text-left transition-colors', !rail && GLASS_TILE)}
							>
								<span className='flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 text-xs font-bold'>{initials(user_name)}</span>
								<span className={cn('flex min-w-0 flex-1 flex-col transition-opacity duration-200', rail ? 'opacity-0' : 'opacity-100 delay-100')}>
									<span className='truncate whitespace-nowrap text-sm font-bold'>{user_name || 'Minha conta'}</span>
									<span className='truncate whitespace-nowrap text-xs text-muted-foreground'>{current_user.data?.email}</span>
								</span>
								{!rail && <ChevronUp className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !profile_open && 'rotate-180')} />}
							</button>
						</PopoverTrigger>
						<PopoverContent side={rail ? 'right' : 'top'} align={rail ? 'end' : 'start'} sideOffset={rail ? 18 : 10} className={cn('w-[236px] overflow-x-hidden rounded-[24px] p-2', GLASS_PANEL)}>
							{profileMenu}
						</PopoverContent>
					</Popover>
					{rail && (
						<button type='button' onClick={logout} aria-label='Sair' title='Sair' className='group pressable relative flex h-11 w-full items-center rounded-2xl pl-[16px] text-muted-foreground transition-colors hover:bg-danger-soft hover:text-destructive'>
							<LogOut className='size-[18px] shrink-0' />
						</button>
					)}
				</div>
			</aside>

			{onToggle && (
				<button
					type='button'
					onClick={onToggle}
					/*
					 * Aberta: na altura do logo. Trilho: centrado NA LINHA divisória (y=77 → topo 63, botão de 28px). A troca
					 * desliza pela borda junto com a largura (mesma duração, leve quique) — "correndo no trilho".
					 */
					style={{ top: rail ? 63 : 44, transition: 'top 340ms cubic-bezier(0.34, 1.35, 0.64, 1)' }}
					title={rail ? 'Expandir menu' : 'Recolher menu'}
					aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
					aria-expanded={!rail}
					className={cn('pressable absolute -right-3.5 z-30 flex size-7 motion-reduce:!transition-none items-center justify-center rounded-full text-muted-foreground hover:text-foreground', GLASS_PANEL)}
				>
					<ChevronLeft className={cn('size-4 transition-transform duration-300', rail && 'rotate-180')} />
				</button>
			)}
		</div>
	);
};

export default Sidebar;
