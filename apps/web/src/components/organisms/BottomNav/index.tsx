import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Menu } from 'lucide-react';

import useNavItems, { type TNavAction } from '@/hooks/useNavItems';

import { cn } from '@/lib/utils';

import NavLinks from '@/components/organisms/NavLinks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	className?: string;
}

const BottomNav = ({ className }: IProps) => {
	const { navItems, centerAction } = useNavItems();
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

	const [ home_item, invites_item, wallets_item ] = navItems;

	const link_class = ({ isActive }: { isActive: boolean }) => cn(
		'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground transition-colors',
		isActive && 'text-foreground',
	);

	return (
		<nav
			className={cn(
				'fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center rounded-2xl border border-border bg-background px-2 shadow-lg',
				className,
			)}
		>
			<NavLink to={home_item.path} end className={link_class}>
				<home_item.icon className='h-5 w-5' />
				{home_item.label}
			</NavLink>
			<NavLink to={invites_item.path} end className={link_class}>
				<invites_item.icon className='h-5 w-5' />
				{invites_item.label}
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
				{wallets_item.label}
			</NavLink>

			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button type='button' className='flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground'>
						<Menu className='h-5 w-5' />
						Menu
					</button>
				</PopoverTrigger>
				<PopoverContent side='top' align='end' sideOffset={16}>
					<NavLinks onNavigate={() => setOpen(false)} />
				</PopoverContent>
			</Popover>
		</nav>
	);
};

export default BottomNav;
