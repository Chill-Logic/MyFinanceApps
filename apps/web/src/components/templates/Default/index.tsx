import { Loader2 } from 'lucide-react';

import useMediaQuery from '@/hooks/useMediaQuery';

import { useCurrentUserContext } from '@/context/current_user';
import { useNewWalletDialog } from '@/context/newWalletDialog';

import { ITemplateProps } from '@/types';

import BottomNav from '@/components/organisms/BottomNav';
import Sidebar from '@/components/organisms/Sidebar';
import WalletFormDialog from '@/components/organisms/WalletFormDialog';

const DefaultTemplate = ({ children }: ITemplateProps) => {
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
	const { is_open: is_new_wallet_open, setIsOpen: setIsNewWalletOpen } = useNewWalletDialog();

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
		<div className='flex h-dvh bg-background'>
			{is_tablet_up && <Sidebar variant={is_desktop ? 'full' : 'rail'} />}

			<div className='flex flex-1 flex-col overflow-hidden'>
				<main className='flex-1 overflow-auto'>
					{/*
					 * No celular, o padding-bottom reserva o espaço da barra flutuante (`--bottom-nav-space`,
					 * ver BottomNav): lista com rolagem própria termina acima dela, e página que rola inteira
					 * ainda deixa o último item visível acima da barra.
					 */}
					<div
						className={
							is_tablet_up
								? 'container mx-auto h-full px-6 pb-6 pt-6 xl:px-9 xl:pt-7'
								: 'container mx-auto h-full px-4 pt-5 pb-[var(--bottom-nav-space)]'
						}
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
		</div>
	);
};

export default DefaultTemplate;
