import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { MoneyUtils, QUERY_KEYS, type TWallet } from '@myfinance/shared';
import { Check, Monitor, Moon, Plus, Star, Sun } from 'lucide-react';

import { useGetMainWallet } from '@/hooks/api/wallets/useGetMainWallet';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';

import { useCurrentUserContext } from '@/context/current_user';
import { type TThemePreference, useTheme } from '@/context/theme';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

/*
 * Peças do menu (redesign 2026-11, mockup v3 "Menu"): vidro, "gota" líquida do item ativo, avatar de carteira,
 * painel de troca de carteira, seletor de tema e "atualizar dados". Usadas pela folha do ☰ (NavMenu), pelo trilho
 * dos tablets e pela barra lateral do desktop (Sidebar).
 */

/* Vidro dos painéis grandes: mesma borda e brilho da barra flutuante, fundo mais denso (legível sobre a tela). */
export const GLASS_PANEL = 'border border-white/60 bg-white/[0.64] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_20px_50px_rgba(8,36,53,0.16)] backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/[0.14] dark:bg-[rgba(11,34,48,0.58)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_20px_60px_rgba(0,0,0,0.5)]';
/* Vidro mais leve dos blocos dentro de um painel (cartões, ladrilhos). */
export const GLASS_TILE = 'border border-white/50 bg-white/50 dark:border-white/[0.08] dark:bg-white/[0.04]';
/* A "gota": mesma pílula translúcida da barra flutuante. */
export const GLASS_BLOB = 'bg-navy/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-[rgba(199,195,191,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]';

type TRect = { left: number; top: number; width: number; height: number };

/*
 * Gota líquida do item ativo: mede o alvo (posição relativa ao pai posicionado) e escorre até ele com quique,
 * esticando no sentido do movimento (keyframes `nav-blob-*` do index.css, alternados pra reiniciar). Remede por
 * ~380ms depois de cada mudança (o painel pode estar animando largura) e quando o alvo muda de tamanho.
 * `active` = chave do item ativo; `getTarget` devolve o elemento dessa chave (ou null = some).
 */
export const useLiquidBlob = (active: string | null, getTarget: ()=> HTMLElement | null) => {
	const [ rect, setRect ] = useState<TRect | null>(null);
	const [ wobble, setWobble ] = useState(0);
	const [ axis, setAxis ] = useState<'x' | 'y'>('x');
	/*
	 * Só anima DEPOIS da primeira medida: senão, ao abrir um painel, a gota "nascia" com largura 0 e crescia até o
	 * item com o quique — passava da largura do painel por um instante e criava rolagem horizontal.
	 */
	const [ animated, setAnimated ] = useState(false);
	const has_rect = Boolean(rect);
	useLayoutEffect(() => {
		if (!has_rect || animated) return undefined;
		const frame = requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
		return () => cancelAnimationFrame(frame);
	}, [ has_rect, animated ]);
	const previous = useRef<{ key: string | null; rect: TRect | null }>({ key: active, rect: null });
	const target_ref = useRef(getTarget);
	target_ref.current = getTarget;

	useLayoutEffect(() => {
		const measure = () => {
			const element = target_ref.current();
			if (!element) {
				setRect(null);
				return null;
			}
			const next = { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
			setRect(next);
			return next;
		};
		const next = measure();
		const before = previous.current;
		if (before.key !== active && before.rect && next) {
			const dx = Math.abs(next.left - before.rect.left);
			const dy = Math.abs(next.top - before.rect.top);
			setAxis(dy > dx ? 'y' : 'x');
			setWobble((count) => count + 1);
		}
		previous.current = { key: active, rect: next };

		let frame = 0;
		const started = performance.now();
		const follow = () => {
			const current = measure();
			previous.current.rect = current;
			if (performance.now() - started < 380) frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		const element = target_ref.current();
		const observer = element ? new ResizeObserver(() => { previous.current.rect = measure(); }) : null;
		if (element) observer?.observe(element);
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
		};
	}, [ active ]);

	return { rect, wobble, axis, animated };
};

export const LiquidBlob = ({ blob, className }: { blob: ReturnType<typeof useLiquidBlob>; className?: string }) => {
	const { rect, wobble, axis, animated } = blob;
	const parity = wobble % 2 ? 'a' : 'b';
	const animation = wobble > 0 ? `nav-blob-${ axis === 'y' ? 'v-' : '' }${ parity } 460ms ease-out` : undefined;
	return (
		<span
			aria-hidden='true'
			className={cn('pointer-events-none absolute z-0 motion-reduce:!animate-none motion-reduce:!transition-none', GLASS_BLOB, !rect && 'opacity-0', className)}
			style={{
				...(rect ?? { left: 0, top: 0, width: 0, height: 0 }),
				animation,
				transition: !animated ? 'none' : 'left 460ms cubic-bezier(0.34, 1.45, 0.64, 1), top 460ms cubic-bezier(0.34, 1.45, 0.64, 1), width 460ms cubic-bezier(0.34, 1.45, 0.64, 1), height 460ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease',
			}}
		/>
	);
};

/* Cores dos avatares de carteira (em ordem, como no mockup). */
const AVATAR_TONES = [
	'bg-gradient-to-br from-[#C5DA9E] to-[#8FA65C] text-navy',
	'bg-gradient-to-br from-[#2F6E8E] to-[#174A66] text-sand-light',
	'bg-gradient-to-br from-[#3BA0B5] to-[#1E6C80] text-sand-light',
	'bg-gradient-to-br from-[#F1D9B0] to-[#D3AF78] text-navy',
];

export const walletInitials = (name: string) => name.trim().split(/\s+/).filter((part) => /[\p{L}\d]/u.test(part)).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

export const WalletAvatar = ({ name, index, className }: { name: string; index: number; className?: string }) => (
	<span aria-hidden='true' className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]', AVATAR_TONES[index % AVATAR_TONES.length], className)}>
		{walletInitials(name)}
	</span>
);

/* "R$ 1.234,56" com o menos (o formatMoney tira o sinal). */
export const walletMoney = (value: number) => `${ value < 0 ? '−' : '' }${ MoneyUtils.formatMoney(Math.abs(value)) }`;

/* Carteiras da pessoa, a em foco e a principal (pros selos). */
export const useWalletChoices = () => {
	const { current_user } = useCurrentUserContext();
	const { data } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();
	const { data: main_wallet } = useGetMainWallet({ enabled: Boolean(current_user.data?.id), params: { user_id: current_user.data?.id || '' } });
	const wallets = data?.data ?? [];
	const active = wallets.find((wallet) => wallet.id === user_wallet.data?.id) ?? null;
	const select = (wallet: TWallet) => setUserWallet({ data: wallet });
	return { wallets, active, active_index: Math.max(0, wallets.findIndex((wallet) => wallet.id === active?.id)), main_id: main_wallet?.id, select };
};

/* Painel de troca de carteira (popover do trilho e da barra lateral). */
export const WalletPanel = ({ onDone, onNewWallet }: { onDone: ()=> void; onNewWallet: ()=> void }) => {
	const { wallets, active, main_id, select } = useWalletChoices();
	const list_ref = useRef<HTMLDivElement>(null);
	const blob = useLiquidBlob(active?.id ?? null, () => list_ref.current?.querySelector<HTMLElement>(`[data-wallet="${ active?.id }"]`) ?? null);

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-start justify-between gap-3 px-1'>
				<div className='flex flex-col'>
					<span className='text-xs text-muted-foreground'>Visualizando a carteira</span>
					<span className='font-bold'>{wallets.length} {wallets.length === 1 ? 'carteira' : 'carteiras'}</span>
				</div>
				<Link to='/carteiras' onClick={onDone} className='text-xs font-bold text-brand hover:opacity-80'>Gerenciar</Link>
			</div>
			<div ref={list_ref} className='relative flex flex-col gap-1'>
				<LiquidBlob blob={blob} className='rounded-2xl ring-1 ring-primary/50' />
				{wallets.map((wallet, index) => {
					const is_active = wallet.id === active?.id;
					return (
						<button
							key={wallet.id}
							type='button'
							data-wallet={wallet.id}
							onClick={() => {
								select(wallet);
								setTimeout(onDone, 260);
							}}
							className='pressable relative z-10 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/30 dark:hover:bg-white/[0.04]'
						>
							<WalletAvatar name={wallet.name} index={index} />
							<span className='flex min-w-0 flex-1 flex-col'>
								<span className='flex items-center gap-1.5'>
									<span className='truncate font-semibold'>{wallet.name}</span>
									{wallet.id === main_id && <Star className='size-3.5 shrink-0 fill-current text-brand' aria-label='Principal' />}
								</span>
							</span>
							<span className='flex shrink-0 flex-col items-end'>
								<span className={cn('text-sm font-bold', wallet.total < 0 && 'text-destructive', wallet.total === 0 && 'text-muted-foreground')}>{walletMoney(wallet.total)}</span>
								{is_active && <span className='flex items-center gap-1 text-[11px] font-semibold text-brand'><Check className='size-3' />Em foco</span>}
							</span>
						</button>
					);
				})}
			</div>
			<button
				type='button'
				onClick={() => {
					onDone();
					onNewWallet();
				}}
				className='pressable flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/20 text-sm font-semibold'
			>
				<Plus className='size-4' />Nova carteira
			</button>
		</div>
	);
};

const THEME_OPTIONS: { value: TThemePreference; label: string; icon: typeof Sun }[] = [
	{ value: 'system', label: 'Seguir o sistema', icon: Monitor },
	{ value: 'light', label: 'Claro', icon: Sun },
	{ value: 'dark', label: 'Escuro', icon: Moon },
];

/* Tema em três posições (Sistema/Claro/Escuro), só ícones, com a gota no escolhido. */
export const ThemeSwitch = ({ className }: { className?: string }) => {
	const { preference, setPreference } = useTheme();
	const ref = useRef<HTMLDivElement>(null);
	const blob = useLiquidBlob(preference, () => ref.current?.querySelector<HTMLElement>(`[data-theme-option="${ preference }"]`) ?? null);
	return (
		<div ref={ref} role='radiogroup' aria-label='Tema' className={cn('relative flex items-center gap-0.5 rounded-full p-1', GLASS_TILE, className)}>
			<LiquidBlob blob={blob} className='rounded-full' />
			{THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
				<button
					key={value}
					type='button'
					role='radio'
					aria-checked={preference === value}
					aria-label={label}
					title={label}
					data-theme-option={value}
					onClick={() => setPreference(value)}
					className={cn('pressable relative z-10 flex size-8 items-center justify-center rounded-full transition-colors', preference === value ? 'text-foreground' : 'text-muted-foreground')}
				>
					<Icon className='size-4' />
				</button>
			))}
		</div>
	);
};

/* "Atualizar dados": invalida todas as queries (como o refresh do app antigo), girando o ícone enquanto roda. */
export const useRefreshAll = () => {
	const [ is_refreshing, setIsRefreshing ] = useState(false);
	const refresh = async() => {
		if (is_refreshing) return;
		setIsRefreshing(true);
		try {
			await Promise.all(Object.values(QUERY_KEYS).flatMap((model_keys) => Object.values(model_keys).map((key) => queryClient.invalidateQueries({ queryKey: [ key ] }))));
		} finally {
			setIsRefreshing(false);
		}
	};
	return { refresh, is_refreshing };
};
