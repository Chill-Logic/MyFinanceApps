import useMediaQuery from '@/hooks/useMediaQuery';

import { cn } from '@/lib/utils';

import { ITemplateProps } from '@/types';

import BottomNav from '@/components/organisms/BottomNav';
import Sidebar from '@/components/organisms/Sidebar';

const DefaultTemplate = ({ children }: ITemplateProps) => {
	/*
	 * Precisa ser desmontado de verdade no breakpoint errado, não só escondido via
	 * `hidden`/CSS — o conteúdo do Popover do hambúrguer (BottomNav) é renderizado num
	 * Portal direto no <body>, fora da <nav>. Escondendo só a nav via CSS, um popover que
	 * já estava aberto ao trocar pra desktop ficava "órfão" flutuando na tela, já que
	 * nenhuma classe `md:hidden` alcança o conteúdo portado. Desmontar o componente
	 * resolve na raiz, não só esse popover específico.
	 */
	const is_desktop = useMediaQuery('(min-width: 768px)');

	return (
		<div className='flex h-screen bg-background-light dark:bg-background-default transition-all duration-300'>
			{is_desktop && <Sidebar />}

			<main className='flex-1 overflow-auto'>
				{/* pb-28 abre espaço pra "ilha" flutuante da BottomNav não tampar o fim do conteúdo
				    no scroll — ela é `fixed`, não empurra o layout sozinha como um item de flex normal */}
				<div className={cn('container mx-auto h-full px-4 py-6', !is_desktop && 'pb-28')}>
					{children}
				</div>
			</main>

			{!is_desktop && <BottomNav />}
		</div>
	);
};

export default DefaultTemplate;
