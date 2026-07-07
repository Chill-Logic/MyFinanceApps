import { CSSProperties } from 'react';

import { CircleAlert, CircleCheck, CircleX, Info, Loader2 } from 'lucide-react';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

import { useTheme } from '@/context/theme';

/**
 * O sonner não é temável via classNames comuns — ele aplica cor/borda/fundo através de
 * `[data-sonner-toast][data-styled='true']`, dois seletores de atributo (especificidade
 * maior que qualquer classe Tailwind isolada), e as cores por tipo só existem sob
 * `[data-rich-colors='true']`. Por isso a customização é via variável CSS (que o sonner lê
 * com `var(--x)`), não via `toastOptions.classNames`.
 */
const toastStyle: CSSProperties = {
	'--normal-bg': 'hsl(var(--background))',
	'--normal-border': 'hsl(var(--border))',
	'--normal-text': 'hsl(var(--foreground))',
	'--success-bg': 'hsl(var(--toast-success-bg))',
	'--success-border': 'hsl(var(--toast-success-border))',
	'--success-text': 'hsl(var(--toast-success-text))',
	'--info-bg': 'hsl(var(--toast-info-bg))',
	'--info-border': 'hsl(var(--toast-info-border))',
	'--info-text': 'hsl(var(--toast-info-text))',
	'--warning-bg': 'hsl(var(--toast-warning-bg))',
	'--warning-border': 'hsl(var(--toast-warning-border))',
	'--warning-text': 'hsl(var(--toast-warning-text))',
	'--error-bg': 'hsl(var(--toast-error-bg))',
	'--error-border': 'hsl(var(--toast-error-border))',
	'--error-text': 'hsl(var(--toast-error-text))',
	'--border-radius': 'var(--radius)',
} as CSSProperties;

const Toaster = (props: ToasterProps) => {
	const { theme } = useTheme();

	return (
		<SonnerToaster
			theme={theme}
			richColors
			closeButton
			style={toastStyle}
			icons={{
				success: <CircleCheck className='h-4 w-4' />,
				error: <CircleX className='h-4 w-4' />,
				warning: <CircleAlert className='h-4 w-4' />,
				info: <Info className='h-4 w-4' />,
				loading: <Loader2 className='h-4 w-4 animate-spin' />,
			}}
			{...props}
		/>
	);
};

export default Toaster;
