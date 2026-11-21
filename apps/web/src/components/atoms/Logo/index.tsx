import icon from '@/assets/brand/icon.svg';
import wordmark_on_dark from '@/assets/brand/wordmark-on-dark.svg';
import wordmark from '@/assets/brand/wordmark.svg';

import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

type TLogoVariant = 'icon' | 'horizontal' | 'stacked';

interface IProps {
	variant?: TLogoVariant;
	/** Altura do ícone em px; o nome acompanha proporcionalmente. */
	size?: number;
	/**
	 * Força o nome claro (para fundo marinho fixo, como o painel da marca no login), independente
	 * do tema. Sem isso, o nome segue o tema: marinho no claro, areia no escuro.
	 */
	onDark?: boolean;
	className?: string;
}

/*
 * Logo vetorizado (src/assets/brand): ícone redesenhado em geometria e nome traçado do PNG original.
 * O quarto marinho do ícone some sobre fundo marinho/escuro — por isso, no tema escuro (ou com
 * `onDark`), o ícone ganha um quadrado areia por trás.
 */
const Logo = ({ variant = 'horizontal', size = 32, onDark = false, className }: IProps) => {
	const { theme } = useTheme();
	const dark_surface = onDark || theme === 'dark';
	const wordmark_src = dark_surface ? wordmark_on_dark : wordmark;

	/* O nome tem proporção 4480×550 ≈ 8,15:1; ~55% da altura do ícone fica equilibrado ao lado. */
	const wordmark_height = Math.round(size * (variant === 'stacked' ? 0.32 : 0.5));

	const mark = (
		<span
			className={cn('flex shrink-0 items-center justify-center', dark_surface && 'bg-sand-light')}
			style={{ width: size, height: size, borderRadius: size * 0.28 }}
		>
			<img src={icon} alt='' width={size * (dark_surface ? 0.8 : 1)} height={size * (dark_surface ? 0.8 : 1)} />
		</span>
	);

	if (variant === 'icon') {
		return <span className={className} role='img' aria-label='MyFinance'>{mark}</span>;
	}

	return (
		<span
			className={cn('inline-flex items-center', variant === 'stacked' ? 'flex-col gap-4' : 'gap-2.5', className)}
			role='img'
			aria-label='MyFinance'
		>
			{mark}
			<img src={wordmark_src} alt='' style={{ height: wordmark_height, width: 'auto' }} />
		</span>
	);
};

export default Logo;
