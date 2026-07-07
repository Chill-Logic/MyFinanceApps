import { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import NavLinks from '@/components/organisms/NavLinks';

interface IProps {
	className?: string;
}

const Sidebar = ({ className }: IProps) => {
	const [ collapsed, setCollapsed ] = useState(false);

	return (
		<aside
			className={cn(
				'flex flex-col justify-between border-r border-border bg-background p-3 transition-all duration-300',
				collapsed ? 'w-16' : 'w-64',
				className,
			)}
		>
			<NavLinks showLabels={!collapsed} />

			<Button
				type='button'
				variant='ghost'
				size='icon'
				className='self-end'
				onClick={() => setCollapsed(!collapsed)}
				aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
			>
				{collapsed ? <ChevronRight className='h-4 w-4' /> : <ChevronLeft className='h-4 w-4' />}
			</Button>
		</aside>
	);
};

export default Sidebar;
