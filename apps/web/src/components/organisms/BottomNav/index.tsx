import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Menu } from 'lucide-react';

import useNavItems, { type TNavAction } from '@/hooks/useNavItems';

import { cn } from '@/lib/utils';

import NavMenu from '@/components/organisms/NavMenu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface IProps {
	className?: string;
}

const BottomNav = ({ className }: IProps) => {
	const { bottomNavItems, centerAction } = useNavItems();
	const [ open, setOpen ] = useState(false);

	/*
	 * Mantém a última ação central conhecida mesmo depois do `centerAction` virar `null`,
	 * pra o ícone continuar visível ENQUANTO o botão encolhe (em vez de sumir instantaneamente
	 * no meio da transição). O slot continua montado sempre — só anima `flex`/escala/opacidade
	 * entre "aberto" e "fechado" — porque um `{condição && <div>}` desmontando na hora não dá
	 * pra animar, e reservar o espaço sempre (sem isso) foi o problema anterior dos outros
	 * itens ficarem com espaçamento torto quando não tinha ação central.
	 */
	const [ displayed_action, setDisplayedAction ] = useState<TNavAction | null>(centerAction);

	useEffect(() => {
		if (centerAction) setDisplayedAction(centerAction);
	}, [ centerAction ]);

	const [ home_item, finances_item, wallets_item ] = bottomNavItems;

	const link_class = ({ isActive }: { isActive: boolean }) => cn(
		'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground transition-colors',
		isActive && 'text-foreground',
	);

	return (
		<nav
			className={cn(
				'relative flex items-center border-t border-border bg-background',
				className,
			)}
		>
			<NavLink to={home_item.path} end className={link_class}>
				<home_item.icon className='h-5 w-5' />
				{home_item.short || home_item.label}
			</NavLink>
			<NavLink to={finances_item.path} end className={link_class}>
				<finances_item.icon className='h-5 w-5' />
				{finances_item.short || finances_item.label}
			</NavLink>

			<div
				className={cn(
					'flex justify-center overflow-hidden transition-[flex-grow] duration-300 ease-out',
					centerAction ? 'flex-1' : 'flex-none basis-0',
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
							'absolute -top-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 ease-out hover:scale-105',
							centerAction ? 'scale-100 opacity-100' : 'pointer-events-none scale-0 opacity-0',
						)}
					>
						<displayed_action.icon className='h-5 w-5' />
					</button>
				)}
			</div>

			<NavLink to={wallets_item.path} end className={link_class}>
				<wallets_item.icon className='h-5 w-5' />
				{wallets_item.short || wallets_item.label}
			</NavLink>

			{/*
			 * Bottom sheet (slide-up + handle + backdrop) no lugar do Popover pequeno anterior —
			 * mesma cara nativa do menu do apps/mobile. O X padrão do Sheet fica escondido
			 * (`hideClose`): fecha por backdrop/Esc/toque num item, como no mobile.
			 *
			 * Altura FIXA (`h-[70dvh]`), não `max-h` — igual ao snap fixo (~60%) do sheet do
			 * mobile. Com `max-h`, expandir/colapsar a lista de carteiras redimensionava o sheet
			 * inteiro e o scroll engatava/desengatava a cada toggle (jank). Fixa, o container de
			 * scroll fica estável: expandir só adiciona conteúdo rolável, sem redimensionar nada.
			 */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<button type='button' className='flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground'>
						<Menu className='h-5 w-5' />
						Menu
					</button>
				</SheetTrigger>
				<SheetContent side='bottom' hideClose aria-describedby={undefined} className='h-[70dvh] gap-0 rounded-t-2xl p-0'>
					<div className='mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border' />
					<NavMenu onClose={() => setOpen(false)} />
				</SheetContent>
			</Sheet>
		</nav>
	);
};

export default BottomNav;
