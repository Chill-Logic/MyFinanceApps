import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ArrowRight, ChevronLeft, Clock, Mail, Trash2, Users, type LucideIcon } from 'lucide-react';

import useMediaQuery from '@/hooks/useMediaQuery';

import { cn } from '@/lib/utils';

import Logo from '@/components/atoms/Logo';
import LegalLinks from '@/components/molecules/LegalLinks';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const BODY = 'text-[14.5px] leading-[1.6] text-foreground/85 lg:text-[15px]';

const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
	<li className='flex gap-3.5'>
		<span className='flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-brand'>{n}</span>
		<span className='flex flex-col gap-0.5 pt-1'>
			<strong className='text-[15px] font-semibold'>{title}</strong>
			<span className={BODY}>{children}</span>
		</span>
	</li>
);

const Item = ({ icon: Icon, tone, title, children }: { icon: LucideIcon; tone: string; title: string; children: ReactNode }) => (
	<div className='flex gap-3'>
		<span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-[11px]', tone)}><Icon className='size-4' /></span>
		<span className='flex flex-col gap-0.5'>
			<strong className='text-[15px] font-semibold'>{title}</strong>
			<span className={BODY}>{children}</span>
		</span>
	</div>
);

/*
 * Página pública de exclusão de conta (mockup v3 "DeletePublic"): a Play exige um link na web, que abra sem o app e
 * sem login, explicando como pedir a exclusão, o que é apagado e os prazos (regras do backend #25).
 */
const DeleteAccountInfoPage = () => {
	const navigate = useNavigate();
	const is_wide = useMediaQuery('(min-width: 1024px)');

	const goBack = () => {
		const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
		if (index > 0) navigate(-1);
		else navigate('/');
	};

	const intro = (
		<div className='flex flex-col gap-2.5'>
			<span className='text-xs font-semibold uppercase tracking-[0.08em] text-brand'>Sua conta</span>
			<h1 className='text-[30px] font-bold leading-[1.1] tracking-[-0.03em] lg:text-[44px]'>Excluir sua conta do MyFinance</h1>
			<p className={BODY}>
				Você pode excluir a sua conta e os seus dados a qualquer momento, pelo app, pelo site ou por e-mail. A conta é
				bloqueada na hora e os dados são apagados em até 30 dias.
			</p>
		</div>
	);

	const how = (
		<section className={cn(SURFACE, 'flex flex-col gap-[18px] rounded-[22px] p-[22px]')}>
			<h2 className='text-lg font-bold tracking-[-0.015em]'>Pelo app ou pelo site</h2>
			<ol className='flex flex-col gap-4'>
				<Step n={1} title='Entre na sua conta'>No app MyFinance ou em myfinance.app.br.</Step>
				<Step n={2} title='Abra Configurações › Conta'>No fim da seção, toque em <strong>Excluir conta</strong>.</Step>
				<Step n={3} title='Confirme'>Digite a sua senha. Se você entra com o Google, digite <strong>EXCLUIR</strong>.</Step>
			</ol>
			<Link to='/configuracoes?secao=conta' className='pressable inline-flex h-[46px] items-center gap-2 self-start rounded-full bg-primary px-[22px] text-[15px] font-bold text-primary-foreground'>
				Entrar e excluir minha conta <ArrowRight className='size-4' />
			</Link>
		</section>
	);

	const email = (
		<section className={cn(SURFACE, 'flex gap-3.5 rounded-[22px] p-[22px]')}>
			<span className='flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-info-soft text-info'><Mail className='size-[18px]' /></span>
			<span className='flex flex-col gap-1.5'>
				<h2 className='text-lg font-bold tracking-[-0.015em]'>Sem acesso à conta?</h2>
				<span className={BODY}>
					Escreva para <strong className='text-foreground'>contato@chillogic.com.br</strong> a partir do e-mail da conta, com o
					assunto “Excluir conta”. Confirmamos o pedido e fazemos a exclusão em até 15 dias.
				</span>
			</span>
		</section>
	);

	const what = (
		<section className='flex flex-col gap-4'>
			<h2 className='text-lg font-bold tracking-[-0.015em]'>O que acontece com os seus dados</h2>
			<Item icon={Trash2} tone='bg-danger-soft text-destructive' title='O que é apagado'>
				Seu nome, e-mail e senha; as carteiras em que só você participa, com contas, cartões, transações e recorrências; as
				conexões MCP e o histórico de alterações.
			</Item>
			<Item icon={Users} tone='bg-info-soft text-info' title='O que fica, sem identificar você'>
				Nas carteiras compartilhadas, o que você lançou continua para os outros membros, como “Usuário removido”. Se você
				administrava a carteira, a administração passa para outro membro.
			</Item>
			<Item icon={Clock} tone='bg-primary/15 text-brand' title='Prazos'>
				A conta é bloqueada na hora do pedido e os dados são apagados de vez em até 30 dias.
			</Item>
		</section>
	);

	const footer = (
		<footer className='flex flex-col gap-2 border-t border-border pt-5 text-[13px] text-muted-foreground lg:flex-row lg:items-center lg:justify-between'>
			<span>MyFinance · um projeto Chillogic</span>
			<LegalLinks className='gap-4' />
		</footer>
	);

	if (is_wide) {
		return (
			<div className='no-scrollbar relative h-[100dvh] overflow-y-auto bg-background text-foreground'>
				<div aria-hidden='true' className='pointer-events-none absolute left-1/2 top-[-360px] h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(163,188,116,0.16)_0%,rgba(163,188,116,0)_100%)]' />
				<header className='relative flex h-[72px] items-center justify-between border-b border-border px-10'>
					<Link to='/' aria-label='MyFinance'><Logo size={28} /></Link>
					<Link to='/entrar' className='pressable inline-flex h-10 items-center gap-2 rounded-full border border-border px-[18px] text-sm font-semibold'>
						Entrar<ArrowRight className='size-[15px]' />
					</Link>
				</header>
				<div className='relative mx-auto flex max-w-[1060px] flex-col gap-8 px-10 pb-[72px] pt-14'>
					<div className='max-w-[720px]'>{intro}</div>
					<div className='grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-5'>
						<div className='flex flex-col gap-5'>{how}{email}</div>
						<div className={cn(SURFACE, 'rounded-[22px] p-6')}>{what}</div>
					</div>
					{footer}
				</div>
			</div>
		);
	}

	return (
		<div className='no-scrollbar h-[100dvh] overflow-y-auto bg-background text-foreground'>
			<header className='pt-safe sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md'>
				<div className='mx-auto grid max-w-2xl grid-cols-[40px_1fr_40px] items-center px-5 py-3'>
					<button type='button' aria-label='Voltar' onClick={goBack} className='pressable flex size-10 items-center justify-center rounded-full border border-border'>
						<ChevronLeft className='size-4' />
					</button>
					<span className='flex justify-center'><Logo size={22} /></span>
				</div>
			</header>
			<div className='pb-safe mx-auto flex max-w-2xl flex-col gap-[22px] px-5 pt-6'>
				{intro}
				{how}
				{email}
				{what}
				<div className='pb-10'>{footer}</div>
			</div>
		</div>
	);
};

export default DeleteAccountInfoPage;
