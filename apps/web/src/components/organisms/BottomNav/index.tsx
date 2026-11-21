import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Menu } from 'lucide-react';

import useNavItems, { type TNavAction } from '@/hooks/useNavItems';

import { cn } from '@/lib/utils';

import NavMenu from '@/components/organisms/NavMenu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

/*
 * Barra inferior do celular (<768px): pílula de vidro FLUTUANTE, fixa sobre o conteúdo.
 *
 * Histórico: já existiu uma versão flutuante que escondia a última transação da lista — dependia de
 * acertar um padding-bottom no conteúdo, e esse padding ficava errado quando a barra mudava de
 * altura com o "+" condicional. O que mudou para ela poder voltar:
 *   1. A altura é FIXA (`h-16`): o "+" fica DENTRO da pílula (só a largura anima), então nada muda
 *      a altura da barra.
 *   2. O espaço que ela ocupa é uma variável única, `--bottom-nav-space` (index.css), usada pelo
 *      DefaultTemplate como padding-bottom da área de conteúdo. Lista com rolagem própria (ex.:
 *      TransactionList) termina ACIMA da barra; página que rola inteira passa por trás do vidro e
 *      ainda deixa o último item visível acima dela.
 * Mudou altura/posição aqui? Mude `--bottom-nav-space` junto.
 */
const BottomNav = () => {
	const { bottomNavItems, centerAction } = useNavItems();
	const [ open, setOpen ] = useState(false);

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

	const link_class = ({ isActive }: { isActive: boolean }) => cn(
		'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
		isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
	);

	return (
		<nav
			aria-label='Navegação principal'
			className='fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-16 -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/80 px-2 shadow-[0_10px_40px_rgba(8,36,53,0.18)] backdrop-blur-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)]'
		>
			<NavLink to={home_item.path} end aria-label={home_item.label} className={link_class}>
				<home_item.icon className='h-5 w-5' />
			</NavLink>
			<NavLink to={finances_item.path} end aria-label={finances_item.label} className={link_class}>
				<finances_item.icon className='h-5 w-5' />
			</NavLink>

			<div
				className={cn(
					'flex justify-center overflow-hidden transition-[width] duration-300 ease-out',
					centerAction ? 'w-[60px]' : 'w-0',
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
							'flex h-12 w-[56px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 ease-out active:scale-95',
							centerAction ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0',
						)}
					>
						<displayed_action.icon className='h-6 w-6' strokeWidth={2.6} />
					</button>
				)}
			</div>

			<NavLink to={wallets_item.path} end aria-label={wallets_item.label} className={link_class}>
				<wallets_item.icon className='h-5 w-5' />
			</NavLink>

			{/*
			 * Bottom sheet (slide-up + alça + fundo escurecido) com o menu completo. Altura FIXA
			 * (`h-[70dvh]`), não `max-h`: com `max-h`, abrir/fechar a lista de carteiras redimensionava o
			 * sheet e o scroll engatava/desengatava a cada toque.
			 */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button type='button' aria-label='Menu' className='flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground'>
						<Menu className='h-5 w-5' />
					</button>
				</SheetTrigger>
				<SheetContent side='bottom' hideClose aria-describedby={undefined} className='h-[70dvh] gap-0 rounded-t-3xl p-0'>
					<div className='mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border' />
					<NavMenu onClose={() => setOpen(false)} />
				</SheetContent>
			</Sheet>
		</nav>
	);
};

export default BottomNav;
