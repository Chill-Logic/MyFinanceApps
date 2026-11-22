import { useState } from 'react';
import { Link } from 'react-router-dom';

import { getApiErrorMessage, listWalletMembers, MoneyUtils, QUERY_KEYS, type TUser, type TWallet } from '@myfinance/shared';
import { useQueries } from '@tanstack/react-query';
import {
	ChevronRight,
	CreditCard,
	Eye,
	Landmark,
	Link2,
	Mail,
	MoreVertical,
	Pencil,
	Plus,
	Star,
	Trash2,
	TriangleAlert,
	UserPlus,
	Users,
	WalletCards,
} from 'lucide-react';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';
import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import { useDeleteWallet } from '@/hooks/api/wallets/useDeleteWallet';
import { useGetMainWallet } from '@/hooks/api/wallets/useGetMainWallet';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useNavItems from '@/hooks/useNavItems';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { usePrimaryAction } from '@/context/primaryAction';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

import Button from '@/components/atoms/Button';
import WalletFormDialog from '@/components/organisms/WalletFormDialog';
import WalletInviteFormDialog from '@/components/organisms/WalletInviteFormDialog';
import Badge from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const HERO = 'relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none';
const HERO_GLOW = 'pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]';
const HERO_CHIP = 'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold';
const HERO_BUTTON = 'pressable flex items-center justify-center gap-2 rounded-full bg-white/10 font-semibold text-sand-light transition-colors hover:bg-white/15';

const splitCents = (formatted: string) => {
	const comma = formatted.lastIndexOf(',');
	return comma === -1 ? [ formatted, '' ] : [ formatted.slice(0, comma), formatted.slice(comma) ];
};
/* O `formatMoney` tira o sinal: o menos (tipográfico) volta aqui. */
const signedMoney = (value: number) => `${ value < 0 ? '−' : '' }${ MoneyUtils.formatMoney(Math.abs(value)) }`;
const plainMoney = (value: number) => `${ value < 0 ? '−' : '' }${ MoneyUtils.formatMoney(Math.abs(value)).replace(/^R\$\s?/, '') }`;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/* "Jéssica", "Jéssica e Marta", "Jéssica, Marta e Pedro". */
const joinNames = (names: string[]) => {
	if (names.length <= 1) return names.join('');
	return `${ names.slice(0, -1).join(', ') } e ${ names[names.length - 1] }`;
};

const Avatar = ({ name, className }: { name: string; className?: string }) => (
	<span aria-hidden='true' className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground ring-2 ring-background', className)}>
		{initials(name)}
	</span>
);

/*
 * Carteiras (redesign 2026-11, mockup v3). A carteira que está sendo vista fica no cartão marinho (selos Principal e
 * Compartilhada, saldo efetivado, membros e as ações de quem administra); as outras vêm em lista (celular, tablet
 * deitado) ou cartões (tablet em pé, desktop), com "Visualizar". Membros por carteira via `GET /wallets/:id/members`.
 * Editar, convidar e excluir só pra quem administra (o backend recusa os outros). A API não tem remover membro, sair
 * da carteira nem transferir — nada disso aparece.
 */
const WalletList = () => {
	const { toast } = useToast();
	const { newWalletAction } = useNavItems();
	const { current_user } = useCurrentUserContext();
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();
	const { data: invites_data } = useListInvites();
	const { mutate: deleteWalletMutation, isPending: is_delete_pending } = useDeleteWallet();
	const { mutate: updateCurrentUserMutation } = useUpdateCurrentUser();

	const me = current_user.data?.id || '';
	const { data: main_wallet } = useGetMainWallet({ enabled: Boolean(me), params: { user_id: me } });

	const [ editing_wallet, setEditingWallet ] = useState<TWallet | null>(null);
	const [ inviting_wallet, setInvitingWallet ] = useState<TWallet | null>(null);
	const [ deleting_wallet, setDeletingWallet ] = useState<TWallet | null>(null);
	const [ setting_main_id, setSettingMainId ] = useState<string | null>(null);

	/* Celular: "Nova carteira" é o "+" da barra flutuante (o do cabeçalho some). */
	usePrimaryAction({ label: 'Nova carteira', onClick: newWalletAction.onClick });

	const wallets = data_wallets?.data || [];
	const invites = (invites_data?.data || []).filter((invite) => !invite.accepted);

	const members_results = useQueries({
		queries: wallets.map((wallet) => ({
			queryKey: [ QUERY_KEYS.wallet.get_members, wallet.id ],
			queryFn: async() => listWalletMembers(getAxiosInstance(), wallet.id),
		})),
	});
	const members_of = (wallet: TWallet): TUser[] => members_results[wallets.indexOf(wallet)]?.data ?? [];

	const active = wallets.find((wallet) => wallet.id === user_wallet.data?.id) ?? wallets[0] ?? null;
	const others = wallets.filter((wallet) => wallet.id !== active?.id);

	/* "só você" / "você e Jéssica" / "de Jéssica · 2 membros" / "3 membros". */
	const membersLabel = (wallet: TWallet, short = false) => {
		const members = members_of(wallet);
		const owner = members.find((member) => member.id === wallet.owner_id);
		const others_names = members.filter((member) => member.id !== me).map((member) => firstName(member.name));
		if (wallet.owner_id !== me) {
			const owner_name = owner ? firstName(owner.name) : 'outra pessoa';
			return `de ${ owner_name }${ members.length > 1 ? ` · ${ members.length } membros` : '' }`;
		}
		if (others_names.length === 0) return short ? 'só você' : 'só você · você administra';
		if (others_names.length <= 2) return `você e ${ joinNames(others_names) }`;
		return `${ members.length } membros · você administra`;
	};

	const handleConfirmDelete = () => {
		if (!deleting_wallet) return;

		deleteWalletMutation({
			id: deleting_wallet.id,
			onSuccess: (data) => {
				toast.success(data.message || 'Carteira excluída');
				if (user_wallet.data?.id === deleting_wallet.id) setUserWallet({ data: null });
				setDeletingWallet(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao excluir a carteira'));
				setDeletingWallet(null);
			},
		});
	};

	/* PATCH /users/me com main_wallet_id; vale pra qualquer carteira acessível. */
	const handleSetMain = (wallet: TWallet) => {
		setSettingMainId(wallet.id);
		updateCurrentUserMutation({
			body: { main_wallet_id: wallet.id },
			onSuccess: () => {
				toast.success(`"${ wallet.name }" agora é sua carteira principal`);
				queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
				setSettingMainId(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao definir carteira principal'));
				setSettingMainId(null);
			},
		});
	};

	const view = (wallet: TWallet) => {
		setUserWallet({ data: wallet });
		toast.success(`Visualizando "${ wallet.name }"`);
	};

	const actionsMenu = (wallet: TWallet, trigger: 'ghost' | 'onDark' = 'ghost') => {
		const is_owner = wallet.owner_id === me;
		const is_main = main_wallet?.id === wallet.id;
		const is_active = wallet.id === active?.id;
		if (is_main && !is_owner && is_active) return null;

		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					{trigger === 'onDark'
						? (
							<button type='button' aria-label={`Ações de ${ wallet.name }`} className={cn(HERO_BUTTON, 'size-11 shrink-0')}>
								<MoreVertical className='size-4' />
							</button>
						)
						: (
							<Button type='button' variant='ghost' size='icon' aria-label={`Ações de ${ wallet.name }`} className='size-8 shrink-0 text-muted-foreground'>
								<MoreVertical className='size-4' />
							</Button>
						)}
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end' className='w-56'>
					{!is_active && (
						<DropdownMenuItem onClick={() => view(wallet)}>
							<Eye className='mr-2 size-4' />
							Visualizar
						</DropdownMenuItem>
					)}
					{!is_main && (
						<DropdownMenuItem onClick={() => handleSetMain(wallet)} disabled={setting_main_id === wallet.id}>
							<Star className='mr-2 size-4' />
							Definir como principal
						</DropdownMenuItem>
					)}
					{is_owner && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setEditingWallet(wallet)}>
								<Pencil className='mr-2 size-4' />
								Editar nome
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setInvitingWallet(wallet)}>
								<UserPlus className='mr-2 size-4' />
								Convidar
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setDeletingWallet(wallet)} className='text-destructive focus:text-destructive'>
								<Trash2 className='mr-2 size-4' />
								Excluir carteira
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	/* ---------- Convites recebidos ---------- */
	const invite_text = () => {
		if (!invites.length) return '';
		const first = invites[0];
		if (invites.length === 1) return `${ firstName(first.owner_name) } quer dividir a carteira “${ first.wallet_name }” com você`;
		return `${ joinNames(invites.slice(0, 2).map((invite) => firstName(invite.owner_name))) }${ invites.length > 2 ? ' e outras pessoas' : '' } querem dividir carteiras com você`;
	};

	const invitesBanner = invites.length > 0 && (
		<Link
			to='/wallets/invites'
			className='pressable flex items-center gap-3 rounded-3xl border border-info/20 bg-info-soft px-4 py-3 lg:hidden'
		>
			<span className='flex -space-x-2'>
				{invites.slice(0, 2).map((invite) => <Avatar key={invite.id} name={invite.owner_name} className='ring-info-soft' />)}
			</span>
			<span className='flex min-w-0 flex-1 flex-col'>
				<span className='font-bold text-info'>{invites.length} {invites.length === 1 ? 'convite recebido' : 'convites recebidos'}</span>
				<span className='truncate text-[13px] text-foreground/80'>{invite_text()}</span>
			</span>
			<span className='hidden h-10 items-center gap-1 rounded-full border border-info/40 px-4 text-sm font-semibold text-info md:flex'>
				Ver convites <ChevronRight className='size-4' />
			</span>
			<ChevronRight className='size-5 shrink-0 text-info md:hidden' />
		</Link>
	);

	/* ---------- A carteira em foco ---------- */
	const hero = () => {
		if (!active) return null;
		const members = members_of(active);
		const is_owner = active.owner_id === me;
		const is_main = main_wallet?.id === active.id;
		const is_shared = members.length > 1;
		const [ main, cents ] = splitCents(signedMoney(active.total));
		const other_names = members.filter((member) => member.id !== me).map((member) => firstName(member.name));

		const memberRow = (member: TUser) => (
			<li key={member.id} className='flex items-center gap-3 py-2.5'>
				<Avatar name={member.name} className='size-9 bg-white/10 text-sand-light ring-0' />
				<span className='flex min-w-0 flex-1 flex-col'>
					<span className='truncate text-sm font-semibold'>
						{firstName(member.name)}{member.id === me && <span className='font-normal text-[#A9B6BF]'> (você)</span>}
					</span>
					<span className='truncate text-xs text-[#A9B6BF]'>{member.email}</span>
				</span>
				{member.id === active.owner_id
					? <span className='rounded-full bg-[rgba(163,188,116,0.2)] px-2.5 py-0.5 text-[11px] font-bold text-[#C5DA9E]'>Admin</span>
					: <span className='text-xs text-[#A9B6BF]'>membro</span>}
			</li>
		);

		const membersPanel = (
			<div className='flex flex-col rounded-2xl border border-white/10 bg-white/5 p-4'>
				<div className='flex items-center justify-between text-xs font-semibold text-[#A9B6BF]'>
					<span>Membros</span>
					<span>{members.length || ''}</span>
				</div>
				<ul className='flex flex-col divide-y divide-white/10 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-x-6 md:max-lg:divide-y-0'>
					{members.map(memberRow)}
				</ul>
				{is_owner && (
					<button
						type='button'
						onClick={() => setInvitingWallet(active)}
						className='pressable mt-2 flex h-11 items-center justify-center gap-2 rounded-full border border-dashed border-white/25 text-sm font-semibold transition-colors hover:bg-white/5 md:max-lg:hidden'
					>
						<Plus className='size-4' />
						Convidar por e-mail
					</button>
				)}
			</div>
		);

		return (
			<section className={cn(HERO, 'p-5 md:p-6')}>
				<div aria-hidden='true' className={HERO_GLOW} />
				<div className='relative flex flex-col gap-5 xl:flex-row xl:items-stretch'>
					<div className='flex min-w-0 flex-1 flex-col gap-4'>
						<div className='flex flex-wrap items-center gap-2'>
							<span className='inline-flex items-center gap-1.5 text-[13px] text-[#A9B6BF]'>
								<span className='size-2 rounded-full bg-success' />
								Visualizando agora
							</span>
							{is_main && <span className={cn(HERO_CHIP, 'bg-[rgba(163,188,116,0.2)] text-[#C5DA9E]')}><Star className='size-3 fill-current' />Principal</span>}
							{is_shared && <span className={cn(HERO_CHIP, 'max-md:hidden')}><Users className='size-3.5' />Compartilhada</span>}
						</div>
						<div className='flex flex-col gap-1'>
							<h2 className='text-2xl font-bold tracking-[-0.03em] md:text-[28px]'>{active.name}</h2>
							<span className='text-[38px] font-semibold leading-none tracking-[-0.045em] md:text-[46px]'>
								{main}<span className='text-[#7F919C]'>{cents}</span>
							</span>
							<span className='mt-1 text-[13px] text-[#A9B6BF]'>saldo efetivado, somando as contas desta carteira</span>
						</div>

						{/* Celular: membros resumidos numa linha. */}
						<div className='flex items-center gap-3 border-t border-white/10 pt-4 md:hidden'>
							<span className='flex -space-x-2'>
								{members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.name} className='bg-white/10 text-sand-light ring-navy' />)}
							</span>
							<span className='flex min-w-0 flex-1 flex-col'>
								<span className='truncate text-sm font-semibold'>{other_names.length ? `Você e ${ joinNames(other_names) }` : 'Só você'}</span>
								<span className='text-xs text-[#A9B6BF]'>{is_owner ? 'você administra' : 'você é membro'}</span>
							</span>
							{is_shared && <span className={HERO_CHIP}><Users className='size-3.5' />Compartilhada</span>}
						</div>

						<div className='flex items-center gap-2 xl:mt-auto'>
							{is_owner && (
								<button
									type='button'
									onClick={() => setInvitingWallet(active)}
									className='pressable flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground max-md:flex-1'
								>
									<UserPlus className='size-4' />
									Convidar
								</button>
							)}
							{is_owner && (
								<button type='button' onClick={() => setEditingWallet(active)} aria-label='Editar nome' className={cn(HERO_BUTTON, 'h-11 px-5 max-md:w-11 max-md:px-0')}>
									<Pencil className='size-4' />
									<span className='max-md:hidden'>Editar nome</span>
								</button>
							)}
							{actionsMenu(active, 'onDark')}
						</div>
					</div>

					<div className='hidden md:block xl:w-[380px] xl:shrink-0'>{membersPanel}</div>
				</div>
			</section>
		);
	};

	/* ---------- As outras ---------- */
	const valueOf = (wallet: TWallet) => (wallet.total === 0
		? <span className='text-muted-foreground'>{MoneyUtils.formatMoney(0)}</span>
		: <span className={cn(wallet.total < 0 && 'text-destructive')}>{signedMoney(wallet.total)}</span>);

	const otherRow = (wallet: TWallet) => (
		<li key={wallet.id} className='flex items-center gap-3 px-4 py-3.5'>
			<button type='button' onClick={() => view(wallet)} className='flex min-w-0 flex-1 items-center gap-3 text-left'>
				<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'>
					<WalletCards className='size-[18px]' />
				</span>
				<span className='flex min-w-0 flex-1 flex-col'>
					<span className='flex min-w-0 items-center gap-2'>
						<span className='truncate font-semibold'>{wallet.name}</span>
						{main_wallet?.id === wallet.id && <Star className='size-3.5 shrink-0 fill-current text-brand' aria-label='Principal' />}
					</span>
					<span className='truncate text-xs text-muted-foreground'>
						{membersLabel(wallet, true)}
					</span>
				</span>
				<span className='shrink-0 font-bold'>
					<span className={cn('lg:hidden', wallet.total < 0 && 'text-destructive', wallet.total === 0 && 'text-muted-foreground')}>{plainMoney(wallet.total)}</span>
					<span className='hidden lg:inline'>{valueOf(wallet)}</span>
				</span>
			</button>
			<Button type='button' variant='outline' onClick={() => view(wallet)} className='hidden h-9 px-4 lg:inline-flex'>Visualizar</Button>
			{actionsMenu(wallet)}
		</li>
	);

	const otherCard = (wallet: TWallet) => {
		const members = members_of(wallet);
		return (
			<article key={wallet.id} className={cn(SURFACE, 'flex flex-col gap-4 rounded-3xl p-5')}>
				<div className='flex items-center gap-2'>
					<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'>
						<WalletCards className='size-[18px]' />
					</span>
					<span className='flex-1' />
					{members.length > 1 && <Badge variant='neutral'>Compartilhada</Badge>}
					{actionsMenu(wallet)}
				</div>
				<div className='flex flex-col gap-0.5'>
					<span className='flex min-w-0 items-center gap-1.5'>
						<span className='truncate text-lg font-bold'>{wallet.name}</span>
						{main_wallet?.id === wallet.id && <Star className='size-4 shrink-0 fill-current text-brand' aria-label='Principal' />}
					</span>
					<span className='truncate text-xs text-muted-foreground'>{membersLabel(wallet)}</span>
				</div>
				<span className='flex items-baseline gap-2 text-[26px] font-semibold tracking-[-0.03em]'>
					{valueOf(wallet)}
					{wallet.total === 0 && <span className='text-xs font-normal tracking-normal text-muted-foreground'>sem saldo efetivado</span>}
				</span>
				<div className='mt-auto flex items-center gap-2 border-t border-border pt-3'>
					<span className='flex -space-x-2'>
						{members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.name} />)}
					</span>
					{members.length > 1 && <span className='text-xs text-muted-foreground'>{members.length} membros</span>}
					<Button type='button' variant='outline' onClick={() => view(wallet)} className='ml-auto h-9 px-4'>Visualizar</Button>
				</div>
			</article>
		);
	};

	const newCard = (
		<button
			type='button'
			onClick={newWalletAction.onClick}
			className='pressable flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border p-5 text-center transition-colors hover:bg-accent/40'
		>
			<span className='flex size-11 items-center justify-center rounded-full border border-border'><Plus className='size-5' /></span>
			<span className='font-bold'>Nova carteira</span>
			<span className='max-w-[220px] text-sm text-muted-foreground'>Para separar a casa, uma viagem ou o dinheiro de alguém</span>
		</button>
	);

	const deleting_members = deleting_wallet ? members_of(deleting_wallet).filter((member) => member.id !== me).map((member) => firstName(member.name)) : [];

	return (
		<div className='flex flex-col gap-5'>
			<header className='flex items-center justify-between gap-3'>
				<h1 className='text-2xl font-bold tracking-[-0.03em] md:text-[28px]'>Carteiras</h1>
				<div className='flex items-center gap-2'>
					{invites.length > 0 && (
						<Link to='/wallets/invites' className='pressable hidden h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:bg-accent lg:flex'>
							<Mail className='size-4' />
							Convites recebidos
							<span className='flex size-6 items-center justify-center rounded-full bg-info-soft text-xs font-bold text-info'>{invites.length}</span>
						</Link>
					)}
					<Button type='button' variant='outline' onClick={newWalletAction.onClick} className='h-11 gap-2 max-md:hidden'>
						<Plus className='size-4' />
						Nova carteira
					</Button>
				</div>
			</header>

			{invitesBanner}

			{isLoading && (
				<>
					<Skeleton className='h-56 w-full rounded-3xl' />
					<Skeleton className='h-40 w-full rounded-3xl' />
				</>
			)}

			{!isLoading && wallets.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
					<WalletCards className='size-9 text-muted-foreground' />
					<span className='font-semibold'>Nenhuma carteira ainda</span>
					<Button type='button' onClick={newWalletAction.onClick} className='gap-2'><Plus className='size-4' />Nova carteira</Button>
				</div>
			)}

			{!isLoading && active && (
				<div className='grid gap-5 lg:max-xl:grid-cols-[minmax(0,470px)_minmax(0,1fr)] lg:max-xl:items-start'>
					{hero()}

					<section className='flex min-w-0 flex-col gap-3'>
						<div className='flex items-baseline justify-between gap-3'>
							<h2 className='font-bold'>Outras carteiras <span className='font-normal text-muted-foreground'>· {others.length}</span></h2>
							<span className='hidden text-xs text-muted-foreground md:block'>Editar, convidar e excluir ficam com quem administra</span>
						</div>

						{others.length > 0 && (
							<ul className={cn(SURFACE, 'flex flex-col divide-y divide-border overflow-hidden rounded-3xl md:hidden lg:max-xl:flex')}>
								{others.map(otherRow)}
							</ul>
						)}
						<div className='hidden gap-3 md:grid md:grid-cols-2 lg:max-xl:hidden xl:grid-cols-4'>
							{others.map(otherCard)}
							{newCard}
						</div>
						<button
							type='button'
							onClick={newWalletAction.onClick}
							className='pressable hidden items-center gap-3 rounded-3xl border border-dashed border-border p-4 text-left transition-colors hover:bg-accent/40 lg:max-xl:flex'
						>
							<span className='flex size-10 items-center justify-center rounded-full border border-border'><Plus className='size-4' /></span>
							<span className='flex flex-col'>
								<span className='font-bold'>Nova carteira</span>
								<span className='text-sm text-muted-foreground'>Para separar a casa, uma viagem ou o dinheiro de alguém</span>
							</span>
						</button>

						<p className='text-xs text-muted-foreground'>
							O saldo de cada carteira soma as contas dela, só com o que já foi efetivado.
							<span className='md:hidden'> Toque numa carteira para visualizá-la.</span>
						</p>
					</section>
				</div>
			)}

			<WalletFormDialog open={Boolean(editing_wallet)} onOpenChange={(open) => !open && setEditingWallet(null)} wallet={editing_wallet} />
			<WalletInviteFormDialog open={Boolean(inviting_wallet)} onOpenChange={(open) => !open && setInvitingWallet(null)} wallet={inviting_wallet} />

			{/* Excluir: diz tudo o que vai junto (a API apaga contas, cartões e conexões da carteira). */}
			<Dialog open={Boolean(deleting_wallet)} onOpenChange={(open) => !open && !is_delete_pending && setDeletingWallet(null)}>
				<DialogContent
					onOpenAutoFocus={(event) => event.preventDefault()}
					className={cn(
						'md:max-w-[460px]',
						'max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0',
						'max-md:data-[state=open]:slide-in-from-bottom-8 max-md:data-[state=open]:zoom-in-100'
					)}
				>
					<span aria-hidden='true' className='mx-auto -mt-2 h-1 w-10 rounded-full bg-border md:hidden' />
					<span className='flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-destructive'><Trash2 className='size-5' /></span>
					<div className='flex flex-col gap-1'>
						<DialogTitle className='text-xl font-bold tracking-[-0.02em]'>Excluir “{deleting_wallet?.name}”?</DialogTitle>
						<DialogDescription>Junto com a carteira, isto é apagado:</DialogDescription>
					</div>
					<ul className='flex flex-col divide-y divide-border rounded-2xl border border-border'>
						{[
							[ Landmark, 'Todas as contas desta carteira' ],
							[ CreditCard, 'Os cartões e as linhas de crédito' ],
							[ Link2, 'As conexões com bancos ligadas a ela' ],
							...(deleting_members.length ? [ [ Users, `${ joinNames(deleting_members) } ${ deleting_members.length === 1 ? 'deixa' : 'deixam' } de ver a carteira` ] ] : []),
						].map(([ Icon, text ]) => {
							const ItemIcon = Icon as typeof Landmark;
							return (
								<li key={text as string} className='flex items-center gap-3 px-4 py-3 text-sm'>
									<span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary'><ItemIcon className='size-4' /></span>
									{text as string}
								</li>
							);
						})}
					</ul>
					<p className='flex items-start gap-2 text-sm text-destructive'>
						<TriangleAlert className='mt-0.5 size-4 shrink-0' />
						Não dá para desfazer. Se quiser só trocar de carteira, use “Visualizar”.
					</p>
					<div className='flex flex-col gap-2 md:flex-row-reverse'>
						<Button type='button' variant='destructive' isLoading={is_delete_pending} onClick={handleConfirmDelete} className='h-12 font-bold md:flex-1'>
							Excluir carteira
						</Button>
						<Button type='button' variant='outline' disabled={is_delete_pending} onClick={() => setDeletingWallet(null)} className='h-12 md:flex-1'>
							Cancelar
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default WalletList;
