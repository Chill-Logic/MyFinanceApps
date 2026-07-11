import { ReactNode, useEffect, useRef, useState } from 'react';

import AboutInfo from '@/components/organisms/AboutInfo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	children: ReactNode;
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
}

/**
 * Popover do "Sobre", reutilizado no NavMenu (mobile) e no Sidebar (desktop). Abre por
 * CLIQUE/TOQUE (funciona no touch) E por HOVER no desktop — o Popover do Radix é só clique, então
 * controlamos o `open` e adicionamos hover no gatilho E no conteúdo, com um pequeno atraso pra
 * fechar (deixa o ponteiro viajar do gatilho pro conteúdo sem o popover sumir no meio). `children`
 * é o gatilho já estilizado por quem usa (a aparência difere entre menu e sidebar).
 */
const AboutPopover = ({ children, side = 'top', align = 'center' }: IProps) => {
	const [ open, setOpen ] = useState(false);
	const close_timeout = useRef<ReturnType<typeof setTimeout>>();

	const openNow = () => {
		if (close_timeout.current) clearTimeout(close_timeout.current);
		setOpen(true);
	};

	const closeSoon = () => {
		close_timeout.current = setTimeout(() => setOpen(false), 120);
	};

	useEffect(() => () => {
		if (close_timeout.current) clearTimeout(close_timeout.current);
	}, []);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild onMouseEnter={openNow} onMouseLeave={closeSoon}>
				{children}
			</PopoverTrigger>
			<PopoverContent side={side} align={align} className='w-60' onMouseEnter={openNow} onMouseLeave={closeSoon}>
				<p className='mb-1.5 text-sm font-medium text-foreground'>Sobre</p>
				<AboutInfo />
			</PopoverContent>
		</Popover>
	);
};

export default AboutPopover;
