import { useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { Moon, Sun } from 'lucide-react';

import useMediaQuery from '@/hooks/useMediaQuery';

import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

import { ITemplateProps } from '@/types';

import Button from '@/components/atoms/Button';
import Logo from '@/components/atoms/Logo';
import LiquidBrand from '@/components/organisms/LiquidBrand';

/*
 * Casca das telas de autenticação (redesign 2026-11, mockup v3), com o fundo líquido + logo de vidro do LiquidBrand.
 *   - Desktop (≥1280) e tablet deitado (≥1024): painel da marca à esquerda (1,15:1 no desktop, metade no tablet) e o
 *     formulário à direita, no fundo do tema.
 *   - Tablet em pé (768–1023): o líquido ocupa a tela, marca no alto e o formulário num cartão de 460px.
 *   - Celular: o líquido ocupa a tela, marca no meio do espaço livre e o formulário numa folha presa embaixo.
 * O losango é desenhado pelo shader no lugar do `mark` (um bloco vazio do tamanho do ícone, que o shader mede a
 * cada quadro); só o nome é imagem. No cadastro do celular o ícone encolhe (são quatro campos).
 */
const AuthTemplate = ({ children }: ITemplateProps) => {
	const { theme, toggleTheme } = useTheme();
	const { pathname } = useLocation();
	const split = useMediaQuery('(min-width: 1024px)');
	const mark_ref = useRef<HTMLSpanElement>(null);
	const compact = pathname.includes('sign-up');

	const brand = (
		<div className='pointer-events-none relative flex flex-col items-center gap-5 md:gap-6 xl:gap-7'>
			<span
				ref={mark_ref}
				aria-hidden='true'
				className={cn('block size-[88px] md:size-[112px] lg:size-[116px] xl:size-[132px]', compact && 'max-md:size-[68px]')}
			/>
			<Logo variant='wordmark' onDark className='h-[22px] md:h-7 lg:h-[29px] xl:h-[34px]' />
		</div>
	);

	const theme_toggle = (
		<Button
			type='button'
			variant='secondary'
			size='icon'
			className='fixed right-4 top-safe-4 z-10'
			onClick={toggleTheme}
			aria-label='Alternar tema'
		>
			{theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
		</Button>
	);

	if (split) {
		return (
			<div className='flex h-[100dvh] overflow-hidden'>
				<section className='relative flex flex-1 items-center justify-center overflow-hidden bg-navy xl:flex-[1.15]'>
					<LiquidBrand markRef={mark_ref} />
					{brand}
				</section>
				<section className='relative flex flex-1 overflow-y-auto bg-background text-foreground'>
					{theme_toggle}
					<div className='m-auto w-[400px] py-12 xl:w-[380px]'>{children}</div>
				</section>
			</div>
		);
	}

	return (
		<div className='relative flex min-h-[100dvh] flex-col bg-navy pt-safe md:items-center md:justify-center md:gap-10 md:py-12'>
			<LiquidBrand markRef={mark_ref} className='fixed' />
			{theme_toggle}
			<div className='flex flex-1 items-center justify-center px-6 pb-7 pt-10 md:flex-none md:p-0'>{brand}</div>
			<div
				className={cn(
					'relative bg-background px-6 pb-[calc(2rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] pt-[26px] text-foreground',
					'rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.25)]',
					'md:w-[460px] md:rounded-[32px] md:p-8 md:shadow-[0_30px_80px_rgba(0,0,0,0.35)]'
				)}
			>
				{children}
			</div>
		</div>
	);
};

export default AuthTemplate;
