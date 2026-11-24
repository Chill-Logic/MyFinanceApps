import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Loader2 } from 'lucide-react';

import useMediaQuery from '@/hooks/useMediaQuery';

import { useCurrentUserContext } from '@/context/current_user';
import { useNewWalletDialog } from '@/context/newWalletDialog';
import { cn } from '@/lib/utils';

import { ITemplateProps } from '@/types';

import { useRefreshAll } from '@/components/molecules/NavKit';
import BottomNav from '@/components/organisms/BottomNav';
import PolicyUpdateDialog from '@/components/organisms/PolicyUpdateDialog';
import PullToRefresh from '@/components/organisms/PullToRefresh';
import Sidebar from '@/components/organisms/Sidebar';
import WalletFormDialog from '@/components/organisms/WalletFormDialog';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

const DefaultShell = ({ children }: ITemplateProps) => {
	/*
	 * Precisa ser desmontado de verdade no breakpoint errado, não só escondido via
	 * `hidden`/CSS — o conteúdo do Popover do hambúrguer (BottomNav) é renderizado num
	 * Portal direto no <body>, fora da <nav>. Escondendo só a nav via CSS, um popover que
	 * já estava aberto ao trocar pra desktop ficava "órfão" flutuando na tela, já que
	 * nenhuma classe `md:hidden` alcança o conteúdo portado. Desmontar o componente
	 * resolve na raiz, não só esse popover específico.
	 */
	/*
	 * Três layouts: celular (<768px) barra inferior flutuante; tablet (768–1279px) trilho de ícones;
	 * desktop (≥1280px) barra lateral completa.
	 */
	const is_tablet_up = useMediaQuery('(min-width: 768px)');
	const is_desktop = useMediaQuery('(min-width: 1280px)');
	const { is_loading: is_current_user_loading } = useCurrentUserContext();
	/*
	 * Só a Início tem altura FIXA (a lista de transações rola por dentro dela). As outras telas crescem com o
	 * conteúdo (`min-h-full`): com `h-full`, o conteúdo maior que a tela vazava da caixa e o padding de baixo —
	 * o espaço da barra flutuante — ficava no meio, então o último item terminava ESCONDIDO atrás da barra.
	 */
	const { pathname } = useLocation();
	const fixed_height = pathname === '/';

	/*
	 * Barra lateral recolhida ou expandida: escolha do usuário, lembrada neste navegador. Sem escolha
	 * salva, o tamanho da tela decide (desktop expandida, tablet recolhida). O botão vale nos dois.
	 */
	const [ sidebar_pref, setSidebarPref ] = useState<'collapsed' | 'expanded' | null>(() => {
		try {
			const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
			if (saved === '1') return 'collapsed';
			if (saved === '0') return 'expanded';
		} catch {
			/* Sem storage (aba privada etc.): segue o tamanho da tela. */
		}
		return null;
	});
	const is_sidebar_collapsed = sidebar_pref ? sidebar_pref === 'collapsed' : !is_desktop;
	const toggleSidebar = () => {
		const next = is_sidebar_collapsed ? 'expanded' : 'collapsed';
		setSidebarPref(next);
		try {
			localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next === 'collapsed' ? '1' : '0');
		} catch {
			/* Sem storage: vale só até recarregar. */
		}
	};
	const { is_open: is_new_wallet_open, setIsOpen: setIsNewWalletOpen } = useNewWalletDialog();

	/* Puxar pra atualizar (toque): escuta a coluna de conteúdo e desce o <main> junto com a gota. */
	const column_ref = useRef<HTMLDivElement>(null);
	const main_ref = useRef<HTMLElement>(null);
	const { refresh } = useRefreshAll();

	/*
	 * Toda página autenticada passa por este template — é o lugar certo pra bloquear a
	 * renderização até o GET /users/me (disparado pelo CurrentUserProvider assim que existe
	 * token) resolver, em vez de deixar cada página decidir isoladamente se espera o usuário
	 * carregar ou não.
	 */
	if (is_current_user_loading) {
		return (
			<div className='flex h-dvh items-center justify-center bg-background'>
				<Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
			</div>
		);
	}

	return (
		/*
		 * `h-dvh`, não `h-screen`: no mobile, `100vh` inclui a área coberta pela barra de
		 * endereço do navegador mesmo quando ela está visível, deixando o layout mais alto
		 * que o viewport realmente exibido — a BottomNav ficava empurrada pra fora da área
		 * visível, só aparecendo depois de rolar a página inteira até o fim. `dvh` (dynamic
		 * viewport height) acompanha o tamanho real e visível do viewport.
		 */
		<div className='relative flex h-dvh bg-background pt-safe'>
			{/*
				 * Brilho oliva no topo (como no mockup): radial suave atrás do cabeçalho. Fica na RAIZ, atrás do menu também —
				 * dentro do <main> ele começava na borda do trilho e marcava uma linha vertical no fundo. Fica numa
				 * caixa com overflow escondido pra o brilho, que é mais largo que a tela, não criar rolagem lateral.
				 */}
			<div aria-hidden='true' className='pointer-events-none absolute inset-x-0 top-0 z-0 h-[300px] overflow-hidden'>
				<div className='absolute -left-20 -right-20 -top-36 h-[420px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(137,161,96,0.24)_0%,rgba(137,161,96,0)_100%)] dark:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(137,161,96,0.20)_0%,rgba(137,161,96,0)_100%)] md:left-0 md:right-auto md:-top-48 md:h-[480px] md:w-[700px] md:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(137,161,96,0.18)_0%,rgba(137,161,96,0)_100%)] md:dark:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(137,161,96,0.14)_0%,rgba(137,161,96,0)_100%)]' />
			</div>

			{is_tablet_up && (
				<Sidebar
					variant={is_sidebar_collapsed ? 'rail' : 'full'}
					onToggle={toggleSidebar}
				/>
			)}

			<div ref={column_ref} className='relative z-10 flex flex-1 flex-col overflow-hidden'>
				<PullToRefresh rootRef={column_ref} contentRef={main_ref} onRefresh={refresh} />
				<main ref={main_ref} className='no-scrollbar relative flex-1 overflow-auto overscroll-y-contain'>
					{/*
					 * No celular, o padding-bottom reserva o espaço da barra flutuante (`--bottom-nav-space`,
					 * ver BottomNav): página que rola inteira deixa o último item visível acima da barra. Lista
					 * com rolagem própria (Home) desfaz esse padding na própria altura para passar por trás do vidro.
					 */}
					<div
						className={cn(
							'container relative mx-auto',
							fixed_height ? 'h-full' : 'min-h-full',
							is_tablet_up ? 'px-6 pb-6 pt-6 xl:px-9 xl:pt-7' : 'px-4 pb-[var(--bottom-nav-space)] pt-5'
						)}
					>
						{children}
					</div>
				</main>
			</div>

			{!is_tablet_up && <BottomNav />}

			{/*
			 * WalletFormDialog montado no topo do template (como o AuthenticatedLayout do mobile
			 * monta a WalletFormModal) — o "Nova Carteira" da nav/página só alterna o contexto.
			 */}
			<WalletFormDialog open={is_new_wallet_open} onOpenChange={setIsNewWalletOpen} />
			{/* Termos/Política pendentes (backend #26): aceite obrigatório antes de seguir. */}
			<PolicyUpdateDialog />
		</div>
	);
};

/*
 * Visitante não vê menu nem barra: na raiz ele está na landing (RootPage) e nas outras telas o RouteGuard já o manda
 * pro Entrar. O componente de fora é sempre este, em toda rota logada, pra navegar entre elas não remontar a casca.
 */
const DefaultTemplate = ({ children }: ITemplateProps) => {
	const { is_authenticated } = useCurrentUserContext();
	if (!is_authenticated) return <>{children}</>;
	return <DefaultShell>{children}</DefaultShell>;
};

export default DefaultTemplate;
