import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Menu, X } from 'lucide-react';

import useNavItems, { type TNavAction } from '@/hooks/useNavItems';

import { cn } from '@/lib/utils';

import { GLASS_PANEL } from '@/components/molecules/NavKit';
import NavMenu from '@/components/organisms/NavMenu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

/*
 * Barra inferior do celular (<768px): pílula de vidro FLUTUANTE, fixa sobre o conteúdo.
 *
 * Histórico: já existiu uma versão flutuante que escondia a última transação da lista — dependia de
 * acertar um padding-bottom no conteúdo, e esse padding ficava errado quando a barra mudava de
 * altura com o "+" condicional. O que mudou para ela poder voltar:
 *   1. A altura é FIXA (`h-[62px]`): o "+" fica DENTRO da pílula (só a largura anima), então nada muda
 *      a altura da barra.
 *   2. O espaço que ela ocupa é uma variável única, `--bottom-nav-space` (index.css), usada pelo
 *      DefaultTemplate como padding-bottom da área de conteúdo. Lista com rolagem própria (ex.:
 *      TransactionList) e página que rola inteira passam POR TRÁS do vidro (senão o que fica atrás
 *      dele é fundo sólido e a barra deixa de parecer flutuante); a última linha ainda para acima dela.
 * Mudou altura/posição aqui? Mude `--bottom-nav-space` junto.
 */
const BottomNav = () => {
	const { bottomNavItems, centerAction } = useNavItems();
	const [ open, setOpen ] = useState(false);
	/*
	 * A barra fica NA FRENTE da folha enquanto ela abre, está aberta e enquanto FECHA: se voltasse pra trás no
	 * instante do clique, a folha descendo (200ms) passava por cima dela.
	 */
	const [ elevated, setElevated ] = useState(false);
	useEffect(() => {
		if (open) {
			setElevated(true);
			return undefined;
		}
		const timer = setTimeout(() => setElevated(false), 260);
		return () => clearTimeout(timer);
	}, [ open ]);

	/*
	 * Mantém a última ação central conhecida depois do `centerAction` virar `null`, pra o ícone
	 * continuar visível ENQUANTO o botão encolhe (em vez de sumir no meio da transição). O slot fica
	 * sempre montado e anima a largura — `{condição && ...}` desmontando na hora não dá pra animar.
	 */
	const [ displayed_action, setDisplayedAction ] = useState<TNavAction | null>(centerAction);

	useEffect(() => {
		if (centerAction) setDisplayedAction(centerAction);
	}, [ centerAction ]);

	const [ home_item, finances_item, wallets_item ] = bottomNavItems;
	const { pathname } = useLocation();

	/*
	 * "Gota" do item ativo: uma pílula de vidro atrás dos ícones que ESCORRE até o destino ao navegar — desliza
	 * com quique (cubic-bezier com overshoot) e estica/achata no caminho (keyframes `nav-blob-a`/`-b`, alternados
	 * a cada troca pra animação reiniciar sem remontar o elemento). Posição medida nos próprios links; enquanto o
	 * slot do "+" anima a largura (300ms), remede a cada quadro pra gota acompanhar. Sem item ativo (ex.: "Contas
	 * do banco"), some. Com "reduzir movimento", só troca de lugar.
	 */
	const item_refs = useRef<(HTMLAnchorElement | null)[]>([]);
	const nav_ref = useRef<HTMLElement>(null);
	/* Com o menu aberto a gota vai pro ☰ (índice 3), que vira ×: a folha "sai" da gota. */
	const route_index = [ home_item, finances_item, wallets_item ].findIndex((item) => item.path === pathname);
	const active_index = open ? 3 : route_index;
	const [ blob, setBlob ] = useState<{ left: number; width: number } | null>(null);
	const [ wobble, setWobble ] = useState(0);
	const previous_index = useRef(active_index);

	useLayoutEffect(() => {
		const measure = () => {
			const element = item_refs.current[active_index];
			if (!element || !nav_ref.current) {
				setBlob(null);
				return;
			}
			setBlob({ left: element.offsetLeft, width: element.offsetWidth });
		};
		measure();
		if (previous_index.current !== active_index && previous_index.current >= 0 && active_index >= 0) setWobble((count) => count + 1);
		previous_index.current = active_index;

		/* O "+" pode estar aparecendo/sumindo junto (largura animada): acompanha por ~350ms. */
		let frame = 0;
		const started = performance.now();
		const follow = () => {
			measure();
			if (performance.now() - started < 360) frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	}, [ active_index, Boolean(centerAction) ]);

	const link_class = ({ isActive }: { isActive: boolean }) => cn(
		'pressable relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-300',
		isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
	);

	return (
		<nav
			ref={nav_ref}
			aria-label='Navegação principal'
			/*
			 * Vidro: desfoque MODERADO e fundo bem translúcido, pra o que passa atrás aparecer (borrado). Com desfoque
			 * de 40px e fundo a 42% a barra virava uma mancha sólida sobre conteúdo simples — perdia o efeito.
			 */
			className={cn(elevated ? 'z-[60]' : 'z-40', 'fixed bottom-[calc(16px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] left-1/2 flex h-[62px] -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/60 bg-white/30 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-1px_0_rgba(255,255,255,0.25),0_10px_30px_rgba(8,36,53,0.16)] backdrop-blur-md backdrop-saturate-[1.8] dark:border-white/[0.14] dark:bg-[rgba(11,34,48,0.26)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(255,255,255,0.04),0_10px_40px_rgba(0,0,0,0.5)]')}
		>
			<span
				aria-hidden='true'
				className={cn(
					'pointer-events-none absolute top-1.5 h-12 rounded-full bg-navy/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] motion-reduce:!transition-none dark:bg-[rgba(199,195,191,0.14)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
					wobble % 2 ? 'animate-[nav-blob-a_460ms_ease-out]' : wobble > 0 && 'animate-[nav-blob-b_460ms_ease-out]',
					'motion-reduce:animate-none',
					!blob && 'opacity-0',
				)}
				style={{
					...(blob ? { left: blob.left, width: blob.width } : { left: 0, width: 48 }),
					/* Inline: a duração em classe perdia pra a padrão (150ms) do utilitário de transição. */
					transition: 'left 460ms cubic-bezier(0.34, 1.45, 0.64, 1), width 460ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease',
				}}
			/>
			<NavLink ref={(element) => { item_refs.current[0] = element; }} to={home_item.path} end aria-label={home_item.label} className={link_class}>
				<home_item.icon className='h-5 w-5' />
			</NavLink>
			<NavLink ref={(element) => { item_refs.current[1] = element; }} to={finances_item.path} end aria-label={finances_item.label} className={link_class}>
				<finances_item.icon className='h-5 w-5' />
			</NavLink>

			<div
				className={cn(
					'flex justify-center overflow-hidden transition-[width] duration-300 ease-out',
					centerAction ? 'w-[58px]' : 'w-0',
				)}
			>
				{displayed_action && (
					<button
						type='button'
						onClick={centerAction?.onClick}
						aria-label={displayed_action.label}
						aria-hidden={!centerAction}
						tabIndex={centerAction ? 0 : -1}
						className={cn(
							'flex h-12 w-[58px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 ease-out active:scale-95',
							centerAction ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0',
						)}
					>
						<displayed_action.icon className='h-[22px] w-[22px]' strokeWidth={2.6} />
					</button>
				)}
			</div>

			<NavLink ref={(element) => { item_refs.current[2] = element; }} to={wallets_item.path} end aria-label={wallets_item.label} className={link_class}>
				<wallets_item.icon className='h-5 w-5' />
			</NavLink>

			{/*
			 * Bottom sheet (slide-up + alça + fundo escurecido) com o menu completo. Altura FIXA
			 * (`h-[70dvh]`), não `max-h`: com `max-h`, abrir/fechar a lista de carteiras redimensionava o
			 * sheet e o scroll engatava/desengatava a cada toque.
			 */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button
						ref={(element) => { item_refs.current[3] = element as unknown as HTMLAnchorElement; }}
						type='button'
						aria-label={open ? 'Fechar menu' : 'Menu'}
						className={cn('pressable relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-colors', open ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
					>
						<Menu className={cn('absolute h-5 w-5 transition-all duration-300', open ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
						<X className={cn('absolute h-5 w-5 transition-all duration-300', open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0')} />
					</button>
				</SheetTrigger>
				{/*
				 * Folha de vidro FLUTUANTE logo acima da barra, com a altura do conteúdo (antes era 70% fixo e sobrava
				 * metade vazia em aparelho alto). A barra fica por cima do fundo escurecido, com o ☰ virado ×.
				 */}
				<SheetContent
					side='bottom'
					hideClose
					aria-describedby={undefined}
					/* Sem foco automático no primeiro botão (o anel aparecia no "Atualizar dados" ao abrir). */
					onOpenAutoFocus={(event) => event.preventDefault()}
					className={cn(
						GLASS_PANEL,
						'inset-x-3 bottom-[calc(16px+62px+12px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] max-h-[min(80dvh,640px)] gap-0 rounded-[32px] p-0 pt-2.5',
						'data-[state=open]:duration-[420ms] data-[state=open]:ease-[cubic-bezier(0.22,1.2,0.36,1)] data-[state=closed]:duration-200'
					)}
				>
					<div className='mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20' />
					<NavMenu onClose={() => setOpen(false)} />
				</SheetContent>
			</Sheet>
		</nav>
	);
};

export default BottomNav;
