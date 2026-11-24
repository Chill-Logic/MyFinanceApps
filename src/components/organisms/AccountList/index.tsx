import { useEffect, useRef, useState } from 'react';

import { getApiErrorMessage, MONTH_NAMES_PT, MoneyUtils, type TAccount } from '@myfinance/shared';
import { AlertTriangle, Banknote, Landmark, Link2, MoreVertical, Pencil, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';

import { useCashProjection } from '@/hooks/api/accounts/useCashProjection';
import { useDeleteAccount } from '@/hooks/api/accounts/useDeleteAccount';
import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import useMediaQuery from '@/hooks/useMediaQuery';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import AccountFormDialog from '@/components/organisms/AccountFormDialog';
import CashProjectionChart from '@/components/organisms/CashProjectionChart';
import MatchReviewDialog, { type TMatchReviewSource } from '@/components/organisms/MatchReviewDialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Badge from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const KIND_ICON = {
	checking: Landmark,
	savings: PiggyBank,
	cash: Banknote,
} as const;

type TRangeDays = 7 | 30 | 90;

const RANGE_SEGMENTS = [
	{ value: '7', label: '7 dias' },
	{ value: '30', label: '30 dias' },
	{ value: '90', label: '90 dias' },
];

/* Superfície clara/translúcida do mockup (branco no claro, véu areia no escuro). */
const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';

/* "R$ 2.531,94" → [ "R$ 2.531", ",94" ] (centavos apagados no número grande). */
const splitCents = (formatted: string) => {
	const index = formatted.lastIndexOf(',');
	return index === -1 ? [ formatted, '' ] : [ formatted.slice(0, index), formatted.slice(index) ];
};

/* "2026-12-10" → "10 dez" (só string, sem fuso). */
const dayName = (date: string) => {
	const [ , month, day ] = date.split('-');
	return `${ Number(day) } ${ MONTH_NAMES_PT[Number(month) - 1]?.slice(0, 3).toLowerCase() ?? '' }`;
};

/*
 * Contas (redesign 2026-11, como no mockup): saldo projetado das contas com gráfico (7/30/90 dias) e o ponto
 * mais baixo, um aviso quando o saldo cai (ou fica negativo) e as contas com o saldo de hoje e o previsto pro
 * fim do mês. Criar/editar/excluir e "para conferir" continuam iguais. A projeção vem de `useCashProjection`,
 * já no contrato do endpoint que o backend ainda vai expor.
 */
const AccountList = ({ createRequest = 0 }: { createRequest?: number }) => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();

	const wallet_id = user_wallet.data?.id;
	const { data: accounts_data, isLoading: is_accounts_loading } = useIndexAccounts({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: deleteAccountMutation, isPending: is_delete_pending } = useDeleteAccount();

	const [ is_create_open, setIsCreateOpen ] = useState(false);
	/* "+" da barra flutuante (FinancesPage): cada incremento abre o formulário de criação. */
	const last_create_request = useRef(createRequest);
	useEffect(() => {
		if (createRequest === last_create_request.current) return;
		last_create_request.current = createRequest;
		setIsCreateOpen(true);
	}, [ createRequest ]);
	const [ editing_account, setEditingAccount ] = useState<TAccount | null>(null);
	const [ deleting_account, setDeletingAccount ] = useState<TAccount | null>(null);
	const [ reviewing_source, setReviewingSource ] = useState<TMatchReviewSource | null>(null);

	const accounts = accounts_data?.data || [];
	const is_loading = is_wallet_loading || is_accounts_loading;

	const [ days, setDays ] = useState<TRangeDays>(30);
	const { data: projection, isFetching: is_projection_fetching } = useCashProjection({
		enabled: accounts.length > 0,
		params: { wallet_id: wallet_id || '', days },
	});
	const is_tablet_up = useMediaQuery('(min-width: 768px)');

	const handleConfirmDelete = () => {
		if (!deleting_account) return;

		deleteAccountMutation({
			id: deleting_account.id,
			onSuccess: () => {
				toast.success('Conta removida com sucesso');
				setDeletingAccount(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover conta'));
				setDeletingAccount(null);
			},
		});
	};

	const total_balance = accounts.reduce((acc, account) => acc + account.balance, 0);
	const start_balance = projection?.start_balance ?? total_balance;
	const [ start_main, start_cents ] = splitCents(MoneyUtils.formatSignedMoney(start_balance));
	const end_of_month = new Map((projection?.accounts ?? []).map((item) => [ item.id, item.end_of_month_balance ]));

	/* Aviso abaixo do gráfico: fica negativo (vermelho) ou só o ponto mais baixo, quando cai em relação a hoje. */
	const first_negative = projection?.points.find((point) => point.balance < 0);
	const renderTip = () => {
		if (!projection) return null;
		if (first_negative) {
			return (
				<div className='flex items-start gap-2.5 rounded-[18px] bg-danger-soft px-4 py-3 text-[13px] leading-snug text-danger'>
					<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
					<span>
						O saldo das contas fica negativo em <b>{dayName(first_negative.date)}</b> e chega a{' '}
						<b>{MoneyUtils.formatSignedMoney(projection.lowest.balance)}</b> em {dayName(projection.lowest.date)}.
					</span>
				</div>
			);
		}
		if (projection.lowest.balance >= start_balance) return null;
		return (
			<div className='flex items-start gap-2.5 rounded-[18px] bg-warning-soft px-4 py-3 text-[13px] leading-snug text-warning'>
				<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
				<span>
					Ponto mais baixo em <b>{dayName(projection.lowest.date)}</b>: {MoneyUtils.formatMoney(projection.lowest.balance)},{' '}
					{MoneyUtils.formatMoney(start_balance - projection.lowest.balance)} abaixo de hoje.
				</span>
			</div>
		);
	};

	const renderAccountMenu = (account: TAccount) => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type='button' variant='ghost' size='icon' aria-label='Ações da conta' className='-mr-2 shrink-0'>
					<MoreVertical className='h-4 w-4' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuItem onClick={() => setEditingAccount(account)}>
					<Pencil className='mr-2 h-4 w-4' />
					Editar
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setDeletingAccount(account)} className='text-destructive focus:text-destructive'>
					<Trash2 className='mr-2 h-4 w-4' />
					Excluir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	const renderSubline = (account: TAccount, eom?: number) => {
		if (account.pending_match_reviews_count > 0) {
			return (
				<button
					type='button'
					onClick={() => setReviewingSource({ type: 'Account', id: account.id, name: account.name })}
					className='self-start rounded-full transition-opacity hover:opacity-80'
				>
					<Badge variant='info'>{account.pending_match_reviews_count} para conferir</Badge>
				</button>
			);
		}
		return (
			<span className='truncate text-xs text-muted-foreground'>
				{eom !== undefined && eom !== account.balance ? `fim do mês ${ MoneyUtils.formatSignedMoney(eom) }` : account.translated_kind}
			</span>
		);
	};

	/* Celular: linha dentro de um cartão só. */
	const renderAccountRow = (account: TAccount) => {
		const Icon = KIND_ICON[account.kind] || Wallet;
		return (
			<li key={account.id} className='flex items-center gap-3 border-b border-border py-3 last:border-b-0'>
				<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-muted-foreground'>
					<Icon className='h-[18px] w-[18px]' />
				</span>
				<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
						<span className='truncate'>{account.name}</span>
						{account.bank_linked && <Link2 className='h-3.5 w-3.5 shrink-0 text-muted-foreground' aria-label='Sincronizada com o banco' />}
					</span>
					{renderSubline(account, end_of_month.get(account.id))}
				</div>
				<span className={cn('shrink-0 text-[15px] font-semibold', account.balance < 0 && 'text-danger')}>
					{MoneyUtils.formatSignedMoney(account.balance)}
				</span>
				{renderAccountMenu(account)}
			</li>
		);
	};

	/* Tablet/desktop: um cartão por conta, com o saldo grande e o fim do mês embaixo (como no mockup). */
	const renderAccountCard = (account: TAccount) => {
		const Icon = KIND_ICON[account.kind] || Wallet;
		const eom = end_of_month.get(account.id);
		return (
			<li key={account.id} className={cn('flex flex-col gap-3 rounded-3xl p-5', SURFACE)}>
				<div className='flex items-center gap-3'>
					<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-muted-foreground'>
						<Icon className='h-[18px] w-[18px]' />
					</span>
					<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
						<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
							<span className='truncate'>{account.name}</span>
							{account.bank_linked && <Link2 className='h-3.5 w-3.5 shrink-0 text-muted-foreground' aria-label='Sincronizada com o banco' />}
						</span>
						{account.pending_match_reviews_count > 0
							? renderSubline(account)
							: <span className='truncate text-xs text-muted-foreground'>{account.translated_kind}</span>}
					</div>
					{renderAccountMenu(account)}
				</div>
				<span className={cn('text-2xl font-semibold tracking-[-0.03em]', account.balance < 0 && 'text-danger')}>
					{MoneyUtils.formatSignedMoney(account.balance)}
				</span>
				<span className='flex justify-between border-t border-border pt-3 text-sm'>
					<span className='text-muted-foreground'>Fim do mês</span>
					<span className={cn('font-semibold', eom !== undefined && eom < 0 && 'text-danger')}>
						{eom === undefined ? '…' : MoneyUtils.formatSignedMoney(eom)}
					</span>
				</span>
			</li>
		);
	};

	return (
		<div className='flex flex-col gap-4 pb-3'>
			{is_loading && (
				<div className='flex flex-col gap-3'>
					<Skeleton className='h-64 w-full rounded-3xl' />
					<Skeleton className='h-40 w-full rounded-3xl' />
				</div>
			)}

			{!is_loading && accounts.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
					<span className='flex h-14 w-14 items-center justify-center rounded-2xl bg-accent'>
						<Wallet className='h-6 w-6 text-muted-foreground' />
					</span>
					<div className='flex flex-col gap-1'>
						<span className='font-semibold'>Nenhuma conta ainda</span>
						<span className='text-sm text-muted-foreground'>Crie uma conta para registrar transações e ver seu saldo.</span>
					</div>
					<Button type='button' variant='secondary' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id}>
						<Plus className='h-4 w-4' />
						Criar conta
					</Button>
				</div>
			)}

			{!is_loading && accounts.length > 0 && (
				<>
					{/* Saldo projetado (cartão marinho, como no mockup) */}
					<section className='relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none'>
						<div aria-hidden='true' className='pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]' />
						<div className='relative flex flex-wrap items-start justify-between gap-4 px-5 pt-5 md:px-6 md:pt-6'>
							<div className='flex flex-col gap-1.5'>
								<span className='text-[13px] font-medium text-[#A9B6BF]'>Saldo projetado · todas as contas</span>
								<span className='text-[40px] font-semibold leading-none tracking-[-0.045em] md:text-[44px]'>
									{start_main}<span className='text-[#7F919C]'>{start_cents}</span>
									<span className='ml-2 text-sm font-medium tracking-normal text-[#A9B6BF]'>hoje</span>
								</span>
								<span className='text-[13px] text-[#A9B6BF]'>
									somando {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}
								</span>
							</div>
							<div className='flex flex-col items-end gap-3 max-sm:w-full max-sm:items-stretch'>
								{projection && (
									<span className='hidden flex-col items-end gap-0.5 sm:flex'>
										<span className='text-xs text-[#A9B6BF]'>Ponto mais baixo</span>
										<span className={cn('text-[15px] font-semibold', projection.lowest.balance < 0 ? 'text-[#F5A99F]' : 'text-[#F2D58A]')}>
											{MoneyUtils.formatSignedMoney(projection.lowest.balance)} · {dayName(projection.lowest.date)}
										</span>
									</span>
								)}
								<SegmentedControl
									tone='onDark'
									className='w-full sm:w-[240px]'
									segments={RANGE_SEGMENTS}
									value={String(days)}
									onChange={(next) => setDays(Number(next) as TRangeDays)}
								/>
							</div>
						</div>
						<div className={cn('relative mt-3 px-1 pb-1 transition-opacity', is_projection_fetching && 'opacity-60')}>
							{projection
								? <CashProjectionChart points={projection.points} lowest={projection.lowest} height={is_tablet_up ? 220 : 170} />
								: <Skeleton className='mx-4 mb-4 h-36 bg-sand-light/10' />}
						</div>
					</section>

					{renderTip()}

					{/* Contas: linhas num cartão só no celular; grade de cartões no tablet/desktop */}
					<ul className={cn('flex flex-col rounded-3xl px-4 md:hidden', SURFACE)}>
						{accounts.map(renderAccountRow)}
					</ul>
					<ul className='hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3'>
						{accounts.map(renderAccountCard)}
					</ul>

					<button
						type='button'
						onClick={() => setIsCreateOpen(true)}
						disabled={!wallet_id}
						className='pressable flex h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-muted-foreground/40 text-sm font-medium text-muted-foreground hover:text-foreground max-md:hidden'
					>
						<Plus className='h-4 w-4' />
						Nova conta
					</button>
				</>
			)}

			<AccountFormDialog open={is_create_open} onOpenChange={setIsCreateOpen} />
			<AccountFormDialog
				open={Boolean(editing_account)}
				onOpenChange={(open) => !open && setEditingAccount(null)}
				account={editing_account}
			/>

			<MatchReviewDialog
				open={Boolean(reviewing_source)}
				onOpenChange={(open) => !open && setReviewingSource(null)}
				source={reviewing_source}
			/>

			<AlertDialog open={Boolean(deleting_account)} onOpenChange={(open) => !open && setDeletingAccount(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir conta</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir "{deleting_account?.name}"? As transações vinculadas também serão removidas. Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default AccountList;
