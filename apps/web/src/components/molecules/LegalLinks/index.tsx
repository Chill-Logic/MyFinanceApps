import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

type TProps = { className?: string; linkClassName?: string };

/* Os dois documentos legais, lado a lado (rodapé das Configurações e das próprias páginas). */
const LegalLinks = ({ className, linkClassName }: TProps) => (
	<span className={cn('flex flex-wrap gap-x-3.5 gap-y-1', className)}>
		<Link to='/termos' className={cn('underline decoration-border underline-offset-[3px] transition-colors hover:text-foreground', linkClassName)}>Termos de Uso</Link>
		<Link to='/privacidade' className={cn('underline decoration-border underline-offset-[3px] transition-colors hover:text-foreground', linkClassName)}>Política de Privacidade</Link>
	</span>
);

export default LegalLinks;
