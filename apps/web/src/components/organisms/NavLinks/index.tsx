import { NavLink } from 'react-router-dom';

import { LogOut, Moon, Sun } from 'lucide-react';

import useNavItems from '@/hooks/useNavItems';

import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

interface IProps {
	onNavigate?: ()=> void;
	showLabels?: boolean;
}

const NavLinks = ({ onNavigate, showLabels = true }: IProps) => {
	const { navItems, newWalletAction } = useNavItems();
	const { logout } = useCurrentUserContext();
	const { theme, toggleTheme } = useTheme();

	const item_class = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground';

	return (
		<nav className='flex flex-col gap-1'>
			{navItems.map(({ id, label, path, icon: Icon }) => (
				<NavLink
					key={id}
					to={path}
					end
					onClick={onNavigate}
					className={({ isActive }) => cn(item_class, isActive && 'bg-secondary text-secondary-foreground')}
				>
					<Icon className='h-4 w-4 shrink-0' />
					{showLabels && label}
				</NavLink>
			))}

			<button type='button' onClick={newWalletAction.onClick} className={item_class}>
				<newWalletAction.icon className='h-4 w-4 shrink-0' />
				{showLabels && newWalletAction.label}
			</button>

			<div className='my-2 border-t border-border' />

			<button type='button' onClick={toggleTheme} className={item_class}>
				{theme === 'dark' ? <Sun className='h-4 w-4 shrink-0' /> : <Moon className='h-4 w-4 shrink-0' />}
				{showLabels && 'Alternar tema'}
			</button>

			<button type='button' onClick={logout} className={item_class}>
				<LogOut className='h-4 w-4 shrink-0' />
				{showLabels && 'Sair'}
			</button>
		</nav>
	);
};

export default NavLinks;
