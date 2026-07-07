import useMediaQuery from '@/hooks/useMediaQuery';

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

			<div className='flex flex-1 flex-col overflow-hidden'>
				<main className='flex-1 overflow-auto'>
					<div className='container mx-auto h-full px-4 py-6'>
						{children}
					</div>
				</main>

				{/*
				 * Docked (não flutuante) de propósito — uma versão flutuante anterior (fixed + margem)
				 * dependia de acertar um padding-bottom exato no conteúdo pra não tampar a última
				 * transação da lista, e isso é frágil (a barra muda de altura com a ação central
				 * condicional). Docked, ela reserva o próprio espaço no flex — impossível esconder
				 * conteúdo por trás dela.
				 */}
				{!is_desktop && <BottomNav />}
			</div>
		</div>
	);
};

export default DefaultTemplate;
