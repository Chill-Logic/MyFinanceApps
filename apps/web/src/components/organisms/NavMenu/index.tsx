import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Check, ChevronLeft, ChevronRight, LogOut, Plus, RefreshCw, Settings, Star } from 'lucide-react';

import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';

import {
	GLASS_TILE,
	LiquidBlob,
	ThemeSwitch,
	useLiquidBlob,
	useRefreshAll,
	useWalletChoices,
	WalletAvatar,
	walletMoney,
} from '@/components/molecules/NavKit';
import { SheetTitle } from '@/components/ui/sheet';

interface IProps {
	onClose: ()=> void;
}

const initials = (name?: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

/**
 * Folha do ☰ no celular (redesign 2026-11, mockup v3 "Menu"): vidro, altura pelo conteúdo. Perfil + atualizar;
 * carteiras em cartões lado a lado (a em foco marcada pela gota, que escorre até a escolhida); destinos em grade
 * 2×2 (o atual com a gota); rodapé com Configurações, tema (Sistema/Claro/Escuro) e Sair.
 */
const NavMenu = ({ onClose }: IProps) => {
	const { navItems, newWalletAction } = useNavItems();
	const { current_user, logout } = useCurrentUserContext();
	const { data: data_invites } = useListInvites();
	const { wallets, active, main_id, select } = useWalletChoices();
	const { refresh, is_refreshing } = useRefreshAll();
	const { pathname } = useLocation();

	const invites_count = (data_invites?.data ?? []).filter((invite) => !invite.accepted).length;

	const wallets_ref = useRef<HTMLDivElement>(null);
	const strip_ref = useRef<HTMLDivElement>(null);
	/* Setas da faixa de carteiras: só aparecem do lado em que ainda há cartão escondido. */
	const [ can_scroll, setCanScroll ] = useState({ left: false, right: false });
	const updateArrows = () => {
		const strip = strip_ref.current;
		if (!strip) return;
		setCanScroll({ left: strip.scrollLeft > 4, right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 });
	};
	const scrollStrip = (direction: 1 | -1) => strip_ref.current?.scrollBy({ left: direction * 160, behavior: 'smooth' });
	const grid_ref = useRef<HTMLDivElement>(null);
	const wallet_blob = useLiquidBlob(active?.id ?? null, () => wallets_ref.current?.querySelector<HTMLElement>(`[data-wallet="${ active?.id }"]`) ?? null);
	const active_nav = navItems.find((item) => item.path === pathname)?.id ?? null;
	const nav_blob = useLiquidBlob(active_nav, () => grid_ref.current?.querySelector<HTMLElement>(`[data-nav="${ active_nav }"]`) ?? null);

	/*
	 * A carteira em foco vem PRIMEIRO na faixa. A ordem é congelada na primeira vez em que a em foco é conhecida:
	 * tocar em outra não a faz pular pro começo enquanto a gota anda e a folha fecha.
	 */
	const first_id = useRef<string | null>(null);
	if (!first_id.current && active) first_id.current = active.id;
	const ordered = [
		...wallets.filter((wallet) => wallet.id === first_id.current),
		...wallets.filter((wallet) => wallet.id !== first_id.current),
	];

	useEffect(() => {
		updateArrows();
	}, [ wallets.length ]);

	const short_label: Record<string, string> = { home: 'Início', finances: 'Contas & Cartões', my_wallets: 'Carteiras', wallets_invites: 'Convites' };

	return (
		<div className='flex min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-1'>
			<SheetTitle className='sr-only'>Menu de navegação</SheetTitle>

			{/* Perfil */}
			<div className='flex items-center gap-3 px-1'>
				<span className='flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary/60 bg-white/40 text-sm font-bold dark:bg-white/[0.06]'>
					{initials(current_user.data?.name)}
				</span>
				<span className='flex min-w-0 flex-1 flex-col'>
					<span className='truncate text-lg font-bold tracking-[-0.02em]'>{current_user.data?.name}</span>
					<span className='truncate text-[13px] text-muted-foreground'>{current_user.data?.email}</span>
				</span>
				<button
					type='button'
					onClick={refresh}
					disabled={is_refreshing}
					aria-label='Atualizar dados'
					className={cn('pressable flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground', GLASS_TILE)}
				>
					<RefreshCw className={cn('size-[18px]', is_refreshing && 'animate-spin')} />
				</button>
			</div>

			{/* Carteiras */}
			<section className='flex flex-col gap-2'>
				<div className='flex items-center justify-between px-1'>
					<span className='text-xs font-semibold text-muted-foreground'>Visualizando a carteira</span>
					<button
						type='button'
						onClick={() => {
							onClose();
							newWalletAction.onClick();
						}}
						className='flex items-center gap-1 text-xs font-bold text-brand'
					>
						<Plus className='size-3.5' />Nova carteira
					</button>
				</div>
				<div className='relative -mx-4'>
					<div ref={strip_ref} onScroll={updateArrows} className='no-scrollbar overflow-x-auto scroll-smooth px-4'>
						<div ref={wallets_ref} className='relative flex w-max gap-2.5 py-0.5'>
							<LiquidBlob blob={wallet_blob} className='rounded-[22px] ring-1 ring-primary/60' />
							{ordered.map((wallet) => {
								/* Cor do avatar pela posição ORIGINAL (a mesma do trilho e da barra lateral). */
								const index = wallets.indexOf(wallet);
								const is_active = wallet.id === active?.id;
								return (
									<button
										key={wallet.id}
										type='button'
										data-wallet={wallet.id}
										aria-pressed={is_active}
										onClick={() => {
											select(wallet);
											setTimeout(onClose, 320);
										}}
										className={cn('pressable relative z-10 flex w-[150px] shrink-0 flex-col gap-2 rounded-[22px] p-3 text-left', !is_active && GLASS_TILE)}
									>
										<span className='flex items-center gap-2'>
											<WalletAvatar name={wallet.name} index={index} className='size-8 rounded-full text-[11px]' />
											{wallet.id === main_id && <span className='flex items-center gap-0.5 text-[11px] font-bold text-brand'><Star className='size-3 fill-current' />Principal</span>}
											{is_active && (
											/* Círculo fixo com o ícone dentro: o SVG direto no flex encolhia e o círculo virava oval. */
												<span className='ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
													<Check className='size-3' strokeWidth={3.5} />
												</span>
											)}
										</span>
										<span className='flex min-w-0 flex-col'>
											<span className='truncate text-sm font-bold'>{wallet.name}</span>
											<span className={cn('truncate text-[15px] font-bold', wallet.total < 0 && 'text-destructive', !is_active && wallet.total >= 0 && 'text-muted-foreground')}>
												{walletMoney(wallet.total)}
											</span>
										</span>
									</button>
								);
							})}
						</div>
					</div>
					{([ [ -1, can_scroll.left ], [ 1, can_scroll.right ] ] as const).map(([ direction, visible ]) => (
						<button
							key={direction}
							type='button'
							tabIndex={visible ? 0 : -1}
							aria-hidden={!visible}
							aria-label={direction < 0 ? 'Carteiras anteriores' : 'Mais carteiras'}
							onClick={() => scrollStrip(direction)}
							className={cn(
								'pressable absolute top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/70 text-foreground shadow-[0_4px_14px_rgba(8,36,53,0.18)] backdrop-blur-md transition-opacity duration-200 dark:border-white/[0.14] dark:bg-[rgba(11,34,48,0.75)]',
								direction < 0 ? 'left-2' : 'right-2',
								visible ? 'opacity-100' : 'pointer-events-none opacity-0'
							)}
						>
							{direction < 0 ? <ChevronLeft className='size-4' /> : <ChevronRight className='size-4' />}
						</button>
					))}
				</div>
			</section>

			{/* Destinos */}
			<nav aria-label='Destinos'>
				<div ref={grid_ref} className='relative grid grid-cols-2 gap-2'>
					<LiquidBlob blob={nav_blob} className='rounded-[20px]' />
					{navItems.map(({ id, path, icon: Icon }) => {
						const is_active = active_nav === id;
						return (
							<NavLink
								key={id}
								to={path}
								end
								data-nav={id}
								onClick={() => setTimeout(onClose, 260)}
								className={cn('pressable relative z-10 flex min-h-[60px] items-center gap-3 rounded-[20px] px-3 py-2.5', !is_active && GLASS_TILE)}
							>
								<span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', is_active ? 'bg-primary text-primary-foreground' : 'bg-white/50 dark:bg-white/[0.06]')}>
									<Icon className='size-[18px]' />
								</span>
								<span className='min-w-0 flex-1 text-sm font-semibold leading-tight'>{short_label[id] ?? id}</span>
								{id === 'wallets_invites' && invites_count > 0 && (
									<span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>{invites_count}</span>
								)}
							</NavLink>
						);
					})}
				</div>
			</nav>

			{/* Rodapé */}
			<div className='flex items-center gap-2 border-t border-foreground/10 pt-4'>
				<NavLink
					to='/configuracoes'
					end
					onClick={() => setTimeout(onClose, 200)}
					className={({ isActive }) => cn('pressable flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-sm font-semibold', GLASS_TILE, isActive && 'ring-1 ring-primary/60')}
				>
					<Settings className='size-4 shrink-0' />
					<span className='truncate'>Configurações</span>
				</NavLink>
				<ThemeSwitch />
				<button
					type='button'
					aria-label='Sair'
					onClick={() => {
						onClose();
						logout();
					}}
					className='pressable flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-destructive'
				>
					<LogOut className='size-[18px]' />
				</button>
			</div>
		</div>
	);
};

export default NavMenu;
