import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BankConnectionUtils, getApiErrorMessage, QUERY_KEYS, type TInvite } from '@myfinance/shared';
import { ArrowRight, Check, Mail, Star, UserRound, WalletCards, X } from 'lucide-react';

import { useAcceptWalletInvite } from '@/hooks/api/user-wallets/useAcceptWalletInvite';
import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import { useRejectWalletInvite } from '@/hooks/api/user-wallets/useRejectWalletInvite';
import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { usePrimaryAction } from '@/context/primaryAction';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

import Button from '@/components/atoms/Button';
import WalletInviteFormDialog from '@/components/organisms/WalletInviteFormDialog';
import Badge from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const HERO = 'relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none';
const HERO_GLOW = 'pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const initial = (name: string) => name.trim()[0]?.toUpperCase() ?? '?';

/* "há 3 h · hoje, 09:14"; quando o relativo já traz a hora ("ontem, 21:23"), só ele. */
const sentLabel = (iso: string) => {
	const relative = BankConnectionUtils.relativeTime(iso);
	return relative.startsWith('há') ? `${ relative } · ${ BankConnectionUtils.whenLabel(iso).toLowerCase() }` : relative;
};

const STEPS = [
	[ 'Alguém compartilha uma carteira', 'usando o e-mail da sua conta.' ],
	[ 'Você aceita ou recusa', 'Recusar pede confirmação; a pessoa pode convidar de novo depois.' ],
	[ 'A carteira entra no seletor', 'ao lado das suas. Dá para torná-la a principal.' ],
];

/*
 * Convites recebidos (redesign 2026-11, mockup v3). A API só lista os PENDENTES (`GET /user_wallets`), então o
 * convite aceito some da resposta: ele fica nesta tela, nesta visita, em "Aceito agora", com "Visualizar agora" e
 * "Definir como principal". Recusar pede confirmação. Convites ENVIADOS não existem na API — não aparecem.
 * O "+" da barra (celular) é "Convidar": abre o convite pra carteira em foco se você a administra; senão, leva a Carteiras.
 */
const InvitesList = () => {
	const { toast } = useToast();
	const navigate = useNavigate();
	const { current_user } = useCurrentUserContext();
	const { user_wallet, setUserWallet } = useWallet();
	const { data: data_invites, isLoading } = useListInvites();
	const { data: wallets_data } = useIndexWallets();
	const { mutate: acceptInviteMutation } = useAcceptWalletInvite();
	const { mutate: rejectInviteMutation, isPending: is_reject_pending } = useRejectWalletInvite();
	const { mutate: updateCurrentUserMutation, isPending: is_main_pending } = useUpdateCurrentUser();

	const [ accepting_id, setAcceptingId ] = useState<string | null>(null);
	const [ rejecting, setRejecting ] = useState<TInvite | null>(null);
	const [ accepted, setAccepted ] = useState<TInvite[]>([]);
	const [ made_main, setMadeMain ] = useState<string[]>([]);
	const [ is_invite_open, setIsInviteOpen ] = useState(false);

	const email = current_user.data?.email;
	const accepted_ids = new Set(accepted.map((invite) => invite.id));
	const pending = (data_invites?.data || []).filter((invite) => !invite.accepted && !accepted_ids.has(invite.id));
	const can_invite = Boolean(user_wallet.data && user_wallet.data.owner_id === current_user.data?.id);

	const openInvite = () => {
		if (can_invite) setIsInviteOpen(true);
		else navigate('/wallets');
	};
	usePrimaryAction({ label: 'Convidar', onClick: openInvite });

	const handleAccept = (invite: TInvite) => {
		setAcceptingId(invite.id);
		acceptInviteMutation({
			id: invite.id,
			onSuccess: () => {
				toast.success(`Agora você faz parte de "${ invite.wallet_name }"`);
				setAccepted((list) => [ invite, ...list ]);
				setAcceptingId(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao aceitar o convite'));
				setAcceptingId(null);
			},
		});
	};

	const handleConfirmReject = () => {
		if (!rejecting) return;
		rejectInviteMutation({
			id: rejecting.id,
			onSuccess: () => {
				toast.success('Convite recusado');
				setRejecting(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao recusar o convite'));
				setRejecting(null);
			},
		});
	};

	const viewNow = (invite: TInvite) => {
		const wallet = wallets_data?.data.find((item) => item.id === invite.wallet_id);
		if (wallet) setUserWallet({ data: wallet });
		navigate('/');
	};

	const makeMain = (invite: TInvite) => {
		updateCurrentUserMutation({
			body: { main_wallet_id: invite.wallet_id },
			onSuccess: () => {
				toast.success(`"${ invite.wallet_name }" agora é sua carteira principal`);
				queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
				setMadeMain((list) => [ ...list, invite.id ]);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao definir carteira principal')),
		});
	};

	const pendingCard = (invite: TInvite) => {
		const is_accepting = accepting_id === invite.id;
		const who = firstName(invite.owner_name);
		const buttons = (
			<div className='flex gap-2 max-md:w-full'>
				<button
					type='button'
					onClick={() => setRejecting(invite)}
					disabled={is_accepting}
					className='pressable flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-5 font-semibold transition-colors hover:bg-white/5 disabled:opacity-50 max-md:flex-1'
				>
					<X className='size-4' />
					Recusar
				</button>
				<Button type='button' onClick={() => handleAccept(invite)} isLoading={is_accepting} className='h-12 px-6 font-bold max-md:flex-[1.3]'>
					{!is_accepting && <Check className='size-4' />}
					<span className='md:hidden'>Aceitar</span>
					<span className='max-md:hidden'>Aceitar convite</span>
				</Button>
			</div>
		);

		return (
			<article key={invite.id} className={cn(HERO, 'p-5 md:p-7')}>
				<div aria-hidden='true' className={HERO_GLOW} />
				<div className='relative flex flex-col gap-4'>
					<div className='flex items-start gap-4'>
						<span className='flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold md:size-12'>{initial(invite.owner_name)}</span>
						<div className='flex min-w-0 flex-1 flex-col'>
							<span className='font-semibold md:text-[15px] md:font-normal md:text-[#A9B6BF]'>
								{who} convidou você<span className='max-md:hidden'> para a carteira</span>
							</span>
							<span className='text-xs text-[#A9B6BF] md:hidden'>
								{sentLabel(invite.created_at)}
							</span>
							<span className='truncate text-[34px] font-bold leading-tight tracking-[-0.04em] max-md:hidden'>{invite.wallet_name}</span>
						</div>
						<span
							className='hidden shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold md:inline-flex'
							title={BankConnectionUtils.whenLabel(invite.created_at)}
						>
							<span className='size-1.5 rounded-full bg-success' />
							{BankConnectionUtils.relativeTime(invite.created_at)}
						</span>
					</div>

					<div className='flex flex-col md:hidden'>
						<span className='text-sm text-[#A9B6BF]'>Carteira</span>
						<span className='text-[32px] font-bold leading-tight tracking-[-0.04em]'>{invite.wallet_name}</span>
					</div>

					<div className='flex flex-col gap-4 md:flex-row md:items-center md:border-t md:border-white/10 md:pt-5'>
						<p className='text-sm leading-relaxed text-[#C9D2D8] md:flex-1'>
							Aceitando, você passa a ver e lançar nas contas e cartões desta carteira.<span className='max-md:hidden'> Ela entra no seletor ao lado das suas.</span>
						</p>
						{buttons}
					</div>
				</div>
			</article>
		);
	};

	const acceptedCard = (invite: TInvite) => {
		const is_main = made_main.includes(invite.id);
		return (
			<article key={invite.id} className={cn(SURFACE, 'flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center')}>
				<div className='flex min-w-0 flex-1 items-start gap-3'>
					<span className='flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold'>{initial(invite.owner_name)}</span>
					<div className='flex min-w-0 flex-col'>
						<span className='flex flex-wrap items-center gap-2'>
							<span className='text-lg font-bold'>{invite.wallet_name}</span>
							<Badge variant='success'><Check className='size-3' />Aceito</Badge>
						</span>
						<span className='text-[13px] text-muted-foreground'>
							de {firstName(invite.owner_name)} · convite {BankConnectionUtils.relativeTime(invite.created_at)}
						</span>
						<span className='mt-1 text-sm text-muted-foreground md:hidden'>A carteira já aparece no seletor, ao lado das suas.</span>
					</div>
				</div>
				<div className='flex gap-2 max-md:w-full'>
					<Button type='button' onClick={() => viewNow(invite)} className='h-11 gap-1.5 px-5 font-bold max-md:flex-1 md:order-2'>
						Visualizar agora
						<ArrowRight className='size-4' />
					</Button>
					<Button
						type='button'
						variant='outline'
						onClick={() => makeMain(invite)}
						disabled={is_main || is_main_pending}
						className='h-11 gap-1.5 px-4 max-md:flex-1 md:order-1'
					>
						<Star className={cn('size-4', is_main && 'fill-current text-brand')} />
						{is_main ? 'Principal' : 'Definir como principal'}
					</Button>
				</div>
			</article>
		);
	};

	const howCard = (
		<section className={cn(SURFACE, 'flex flex-col gap-4 rounded-3xl p-5 md:p-6')}>
			<h3 className='font-bold'>Como funcionam os convites</h3>
			<ol className='grid gap-4 md:grid-cols-3 xl:grid-cols-1'>
				{STEPS.map(([ title, text ], index) => (
					<li key={title} className='flex gap-3 md:flex-col xl:flex-row'>
						<span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold'>{index + 1}</span>
						<span className='flex flex-col'>
							<span className='font-semibold'>{title}</span>
							<span className='text-sm text-muted-foreground'>{text}</span>
						</span>
					</li>
				))}
			</ol>
			<div className='flex flex-col gap-3 md:flex-row xl:flex-col'>
				{email && (
					<span className='flex flex-1 items-center gap-2 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info'>
						<Mail className='size-4 shrink-0' />
						<span className='min-w-0 truncate'>Seu e-mail: <strong className='font-semibold'>{email}</strong></span>
					</span>
				)}
				<Button type='button' variant='outline' onClick={openInvite} className='h-12 gap-2 px-5 font-semibold'>
					{can_invite ? 'Convidar alguém' : 'Convidar alguém em Carteiras'}
					<ArrowRight className='size-4' />
				</Button>
			</div>
		</section>
	);

	const empty = (
		<div className='flex flex-col items-center gap-4 px-2 py-8 text-center md:py-12'>
			<span className='relative flex size-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-navy-light to-navy text-sand-light'>
				<Mail className='size-9' />
				<span className='absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground'>
					<Check className='size-3.5' strokeWidth={3} />
				</span>
			</span>
			<h2 className='text-2xl font-bold tracking-[-0.03em]'>Nenhum convite por aqui</h2>
			<p className='max-w-[360px] text-muted-foreground'>
				Quando alguém compartilhar uma carteira com você, o convite aparece aqui para você aceitar ou recusar.
			</p>
			<ul className={cn(SURFACE, 'flex w-full max-w-[420px] flex-col divide-y divide-border rounded-3xl text-left')}>
				{email && (
					<li className='flex items-center gap-3 p-4'>
						<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'><UserRound className='size-[18px]' /></span>
						<span className='flex min-w-0 flex-col'>
							<span className='text-xs text-muted-foreground'>Peça para convidarem este e-mail</span>
							<span className='truncate font-bold'>{email}</span>
						</span>
					</li>
				)}
				<li className='flex items-center gap-3 p-4'>
					<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'><WalletCards className='size-[18px]' /></span>
					<span className='flex flex-col'>
						<span className='text-xs text-muted-foreground'>Quer dividir uma carteira sua?</span>
						<span className='font-bold'>Convide pela tela Carteiras</span>
					</span>
				</li>
			</ul>
			<Link to='/wallets' className='pressable flex h-12 w-full max-w-[420px] items-center justify-center gap-2 rounded-full border border-border font-semibold transition-colors hover:bg-accent'>
				Ir para Carteiras <ArrowRight className='size-4' />
			</Link>
		</div>
	);

	const has_any = pending.length > 0 || accepted.length > 0;

	return (
		<div className='flex flex-col gap-5'>
			<header className='flex flex-col gap-1'>
				<h1 className='text-2xl font-bold tracking-[-0.03em] md:text-[28px]'>Convites</h1>
				<p className='text-sm text-muted-foreground'>Carteiras que compartilharam com você</p>
			</header>

			{isLoading && <Skeleton className='h-56 w-full rounded-3xl' />}

			{!isLoading && !has_any && empty}

			{!isLoading && has_any && (
				<div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start'>
					<div className='flex min-w-0 flex-col gap-5'>
						{pending.length > 0 && (
							<section className='flex flex-col gap-2.5'>
								<div className='flex items-center justify-between text-xs font-semibold text-muted-foreground'>
									<span>Esperando sua resposta</span>
									<span>{pending.length} {pending.length === 1 ? 'convite' : 'convites'}</span>
								</div>
								{pending.map(pendingCard)}
							</section>
						)}
						{accepted.length > 0 && (
							<section className='flex flex-col gap-2.5'>
								<span className='text-xs font-semibold text-muted-foreground'>Aceito agora</span>
								{accepted.map(acceptedCard)}
							</section>
						)}
						{email && (
							<p className='flex items-start gap-2.5 rounded-2xl bg-info-soft px-4 py-3 text-sm text-info md:hidden'>
								<Mail className='mt-0.5 size-4 shrink-0' />
								<span>Convites chegam para <strong className='font-semibold'>{email}</strong> quando alguém compartilha uma carteira com você.</span>
							</p>
						)}
					</div>
					<div className='max-md:hidden'>{howCard}</div>
				</div>
			)}

			<WalletInviteFormDialog open={is_invite_open} onOpenChange={setIsInviteOpen} wallet={user_wallet.data} />

			{/* Recusar: folha no celular, diálogo do tablet em diante. */}
			<Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && !is_reject_pending && setRejecting(null)}>
				<DialogContent
					onOpenAutoFocus={(event) => event.preventDefault()}
					className={cn(
						'md:max-w-[440px]',
						'max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0',
						'max-md:data-[state=open]:slide-in-from-bottom-8 max-md:data-[state=open]:zoom-in-100'
					)}
				>
					<span aria-hidden='true' className='mx-auto -mt-2 h-1 w-10 rounded-full bg-border md:hidden' />
					<span className='flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-destructive'><X className='size-5' /></span>
					<div className='flex flex-col gap-1.5'>
						<DialogTitle className='text-xl font-bold tracking-[-0.02em]'>Recusar o convite de {rejecting ? firstName(rejecting.owner_name) : ''}?</DialogTitle>
						<DialogDescription>
							Você não vai ter acesso à carteira <strong className='font-semibold text-foreground'>{rejecting?.wallet_name}</strong>.
							{' '}Se mudar de ideia, {rejecting ? firstName(rejecting.owner_name) : 'a pessoa'} pode convidar você de novo.
						</DialogDescription>
					</div>
					<div className='flex flex-col gap-2 md:flex-row-reverse'>
						<Button type='button' variant='destructive' isLoading={is_reject_pending} onClick={handleConfirmReject} className='h-12 font-bold md:flex-1'>
							Recusar convite
						</Button>
						<Button type='button' variant='outline' disabled={is_reject_pending} onClick={() => setRejecting(null)} className='h-12 md:flex-1'>
							Voltar
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default InvitesList;
