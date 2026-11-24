import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ArrowRight, ChevronLeft } from 'lucide-react';

import useMediaQuery from '@/hooks/useMediaQuery';

import { cn } from '@/lib/utils';
import { LEGAL_INFO, type TLegalBlock, type TLegalDocument } from '@/util/legalDocuments';

import Logo from '@/components/atoms/Logo';
import LegalLinks from '@/components/molecules/LegalLinks';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const BODY = 'text-[14.5px] leading-[1.62] text-foreground/85 lg:text-[15px] lg:leading-[1.65]';

/* `[[rótulo]]` vira o valor de `LEGAL_INFO`; enquanto o valor não existe, o rótulo aparece destacado. */
const fill = (text: string): ReactNode => text.split(/\[\[(.+?)\]\]/).map((part, index) => {
	if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
	const value = LEGAL_INFO[part];
	if (value) return <Fragment key={index}>{value}</Fragment>;
	return <mark key={index} className='whitespace-nowrap rounded-md bg-warning-soft px-1.5 font-semibold text-warning'>{part}</mark>;
});

const Block = ({ block }: { block: TLegalBlock }) => {
	if (block.kind === 'p') return <p className={BODY}>{fill(block.text)}</p>;
	if (block.kind === 'dl') {
		return (
			<dl className={cn(SURFACE, 'divide-y divide-border rounded-[20px]')}>
				{block.items.map(([ term, description ]) => (
					<div key={term} className='flex flex-col gap-1 px-[18px] py-3.5'>
						<dt className='text-sm font-semibold'>{term}</dt>
						<dd className={cn(BODY, 'text-[14px] lg:text-[14.5px]')}>{fill(description)}</dd>
					</div>
				))}
			</dl>
		);
	}
	return (
		<ul className={cn(BODY, 'flex flex-col gap-1.5')}>
			{block.items.map((item, index) => (
				<li key={item} className='flex gap-2.5'>
					<span className='min-w-4 shrink-0 text-muted-foreground'>{block.kind === 'ol' ? `${ String.fromCharCode(97 + index) })` : '•'}</span>
					<span>{fill(item)}</span>
				</li>
			))}
		</ul>
	);
};

const number = (index: number) => String(index + 1).padStart(2, '0');

/*
 * Página de um documento legal (mockup v3: "Política de Privacidade" / "Termos de Uso"). Pública: abre sem login,
 * porque a Play e quem recebe o link precisam lê-la sem conta.
 *   - Celular e tablet: cabeçalho de vidro preso no topo (voltar + logo), título, cartão "Nesta página" e o texto.
 *   - Desktop/tablet deitado (≥1024): barra com o logo e "Abrir o MyFinance"; sumário fixo à esquerda, com a seção
 *     visível destacada, e o texto numa coluna de leitura.
 * A página é o próprio contêiner de rolagem (sem barra, como o resto do app).
 */
const LegalDocument = ({ doc }: { doc: TLegalDocument }) => {
	const navigate = useNavigate();
	const is_wide = useMediaQuery('(min-width: 1024px)');
	const scroll_ref = useRef<HTMLDivElement>(null);
	const [ active, setActive ] = useState(doc.sections[0].id);

	/* Sumário do desktop: destaca a seção que está no terço de cima da tela. */
	useEffect(() => {
		const root = scroll_ref.current;
		if (!root || !is_wide) return undefined;
		const observer = new IntersectionObserver((entries) => {
			const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
			if (visible[0]) setActive(visible[0].target.id);
		}, { root, rootMargin: '0px 0px -70% 0px' });
		root.querySelectorAll('section[id]').forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	}, [ doc, is_wide ]);

	const goTo = (id: string) => {
		scroll_ref.current?.querySelector(`#${ id }`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	/* Quem chegou por um link de fora (a Play, um e-mail) não tem pra onde voltar: vai pro app. */
	const goBack = () => {
		const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
		if (index > 0) navigate(-1);
		else navigate('/');
	};

	const intro = (
		<div className='flex flex-col gap-2.5'>
			<span className='text-xs font-semibold uppercase tracking-[0.08em] text-brand'>Documentos legais</span>
			<h1 className='text-[30px] font-bold leading-[1.1] tracking-[-0.03em] lg:text-[44px]'>{doc.title}</h1>
			<span className='text-[13.5px] text-muted-foreground'>Versão {doc.version} · vigente desde {fill('[[data de publicação]]')}</span>
		</div>
	);

	const article = (
		<article className='flex flex-col gap-7'>
			{doc.sections.map((section, index) => (
				<section key={section.id} id={section.id} className='flex scroll-mt-24 flex-col gap-3 lg:scroll-mt-8'>
					<h2 className='flex items-baseline gap-2.5 text-[17px] font-semibold tracking-[-0.015em] lg:text-[19px]'>
						<span className='font-mono text-[13px] font-medium text-brand'>{number(index)}</span>{section.title}
					</h2>
					{section.blocks.map((block, block_index) => <Block key={block_index} block={block} />)}
				</section>
			))}
		</article>
	);

	const footer = (
		<footer className='flex flex-col gap-2 border-t border-border pt-5 text-[13px] text-muted-foreground lg:flex-row lg:items-center lg:justify-between'>
			<span>MyFinance · um projeto Chillogic</span>
			<LegalLinks className='gap-4' />
		</footer>
	);

	if (is_wide) {
		return (
			<div ref={scroll_ref} className='no-scrollbar relative h-[100dvh] overflow-y-auto bg-background text-foreground'>
				<div aria-hidden='true' className='pointer-events-none absolute left-1/2 top-[-360px] h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(163,188,116,0.16)_0%,rgba(163,188,116,0)_100%)]' />
				<header className='relative flex h-[72px] items-center justify-between border-b border-border px-10'>
					<Link to='/' aria-label='MyFinance'><Logo size={28} /></Link>
					<Link to='/' className='pressable inline-flex h-10 items-center gap-2 rounded-full border border-border px-[18px] text-sm font-semibold'>
						Abrir o MyFinance<ArrowRight className='size-[15px]' />
					</Link>
				</header>
				<div className='relative mx-auto grid max-w-[1060px] grid-cols-[260px_minmax(0,1fr)] items-start gap-16 px-10 pb-[72px] pt-14'>
					<nav aria-label='Nesta página' className='sticky top-8 flex flex-col gap-0.5'>
						<span className='px-3 pb-2.5 text-xs font-semibold text-muted-foreground'>Nesta página</span>
						{doc.sections.map((section, index) => (
							<button
								key={section.id}
								type='button'
								onClick={() => goTo(section.id)}
								className={cn(
									'pressable flex items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13.5px] transition-colors',
									active === section.id ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
								)}
							>
								<span className='font-mono text-[11.5px] text-muted-foreground'>{number(index)}</span>{section.title}
							</button>
						))}
					</nav>
					<div className='flex max-w-[700px] flex-col gap-9'>
						{intro}
						{article}
						{footer}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div ref={scroll_ref} className='no-scrollbar h-[100dvh] overflow-y-auto bg-background text-foreground'>
			<header className='pt-safe sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md'>
				<div className='mx-auto grid max-w-2xl grid-cols-[40px_1fr_40px] items-center px-5 py-3'>
					<button type='button' aria-label='Voltar' onClick={goBack} className='pressable flex size-10 items-center justify-center rounded-full border border-border'>
						<ChevronLeft className='size-4' />
					</button>
					<span className='flex justify-center'><Logo size={22} /></span>
				</div>
			</header>
			<div className='pb-safe mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-6'>
				{intro}
				<nav aria-label='Nesta página' className={cn(SURFACE, 'flex flex-col rounded-[20px] px-[18px] py-3')}>
					<span className='pb-1 text-xs font-semibold text-muted-foreground'>Nesta página</span>
					{doc.sections.map((section, index) => (
						<button key={section.id} type='button' onClick={() => goTo(section.id)} className='pressable flex gap-2.5 py-[7px] text-left text-sm'>
							<span className='pt-px font-mono text-xs text-muted-foreground'>{number(index)}</span>{section.title}
						</button>
					))}
				</nav>
				{article}
				<div className='pb-10'>{footer}</div>
			</div>
		</div>
	);
};

export default LegalDocument;
