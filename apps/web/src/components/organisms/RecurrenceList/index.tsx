import { useEffect, useMemo, useState } from 'react';

import {
	getApiErrorMessage,
	MONTH_NAMES_PT,
	MoneyUtils,
	RecurrenceUtils,
	type TRecurrence,
	type TRecurrenceType,
	type TTransactionSourceType,
} from '@myfinance/shared';
import {
	Check,
	ChevronDown,
	CreditCard,
	Info,
	Landmark,
	Link2,
	MoreVertical,
	Pencil,
	Repeat,
	Search,
	Trash2,
	X,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteRecurrence } from '@/hooks/api/recurrences/useDeleteRecurrence';
import { useIndexRecurrences } from '@/hooks/api/recurrences/useIndexRecurrences';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import {
	dayMonth,
	installmentProgress,
	isEnded,
	isEstimated,
	KIND_VISUAL,
	monthShort,
	monthYear,
	plainMoney,
	ruleText,
	splitCents,
	valueText,
	ymdParts,
} from '@/util/recurrenceView';

import Button from '@/components/atoms/Button';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import RecurrenceFormDialog from '@/components/organisms/RecurrenceFormDialog';
import TransactionFormDialog from '@/components/organisms/TransactionFormDialog';
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const HERO = 'relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none';
const HERO_GLOW = 'pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]';

const SourceIcon = ({ type, className }: { type: TTransactionSourceType; className?: string }) => (
	type === 'CreditBalance' ? <CreditCard className={className} /> : <Landmark className={className} />
);

interface IProps {
	/* "Nova recorrência" mora no cabeçalho da página (FinancesPage); o formulário abre aqui. */
	creating: boolean;
	onCreatingChange: (open: boolean)=> void;
}

/*
 * Aba Recorrências (redesign 2026-11, mockup v3). Recorrentes: lista no celular, tabela do tablet em diante, com o
 * resumo "Por mês" e as "Próximas" numa coluna à direita a partir do tablet deitado. Parceladas: cartões com o
 * progresso das parcelas e o resumo "Falta pagar" em cima. Busca (`terms`) e filtro por origem vão pra API.
 * "Nova recorrência" abre o formulário de transação já com Repetir ligado.
 */
const RecurrenceList = ({ creating, onCreatingChange }: IProps) => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();
	const [ recurrence_type, setRecurrenceType ] = useState<TRecurrenceType>('recurring');
	const [ editing, setEditing ] = useState<TRecurrence | null>(null);
	const [ deleting, setDeleting ] = useState<TRecurrence | null>(null);
	const [ search_open, setSearchOpen ] = useState(false);
	const [ search, setSearch ] = useState('');
	const [ terms, setTerms ] = useState('');
	const [ origin, setOrigin ] = useState<{ type: TTransactionSourceType; id: string; name: string } | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => setTerms(search.trim()), 300);
		return () => clearTimeout(timer);
	}, [ search ]);

	const wallet_id = user_wallet.data?.id || '';
	const base_params = {
		wallet_id,
		per_page: 100,
		...(terms ? { terms } : {}),
		...(origin ? { source_type: origin.type, source_id: origin.id } : {}),
	};
	const recurring_query = useIndexRecurrences({ enabled: Boolean(wallet_id), params: { ...base_params, recurrence_type: 'recurring' } });
	const installment_query = useIndexRecurrences({ enabled: Boolean(wallet_id), params: { ...base_params, recurrence_type: 'installment' } });
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id } });
	const { data: credits_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id } });
	const { mutate: deleteRecurrenceMutation, isPending: is_delete_pending } = useDeleteRecurrence();

	const recurring = useMemo(() => recurring_query.data?.data ?? [], [ recurring_query.data ]);
	const installments = useMemo(() => installment_query.data?.data ?? [], [ installment_query.data ]);
	const active_query = recurrence_type === 'recurring' ? recurring_query : installment_query;
	const items = recurrence_type === 'recurring' ? recurring : installments;
	const is_loading = is_wallet_loading || active_query.isLoading;
	const has_filter = Boolean(terms || origin);

	/* Ativas primeiro (pela próxima data); encerradas no fim. */
	const sorted = useMemo(() => [ ...items ].sort((a, b) => {
		if (isEnded(a) !== isEnded(b)) return isEnded(a) ? 1 : -1;
		return (a.next_occurrence?.transaction_date ?? '').localeCompare(b.next_occurrence?.transaction_date ?? '');
	}), [ items ]);

	const handleConfirmDelete = () => {
		if (!deleting) return;

		deleteRecurrenceMutation({
			id: deleting.id,
			onSuccess: () => {
				toast.success(deleting.recurrence_type === 'installment' ? 'Compra parcelada removida' : 'Recorrência removida');
				setDeleting(null);
				setEditing(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover'));
				setDeleting(null);
			},
		});
	};

	const segments = [
		{ value: 'recurring', label: 'Recorrentes', count: recurring.length },
		{ value: 'installment', label: 'Parceladas', count: installments.length },
	];

	const actionsMenu = (recurrence: TRecurrence) => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type='button' variant='ghost' size='icon' aria-label='Ações' className='size-8 shrink-0 text-muted-foreground'>
					<MoreVertical className='size-4' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuItem onClick={() => setEditing(recurrence)}>
					<Pencil className='mr-2 size-4' />
					Editar
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setDeleting(recurrence)} className='text-destructive focus:text-destructive'>
					<Trash2 className='mr-2 size-4' />
					Excluir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	/* ---------- Filtro por origem ---------- */
	const origin_options = [
		...(accounts_data?.data ?? []).map((account) => ({ type: 'Account' as const, id: account.id, name: account.name })),
		...(credits_data?.data ?? []).map((credit) => ({ type: 'CreditBalance' as const, id: credit.id, name: credit.name })),
	];
	const originFilter = (icon_only: boolean) => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type='button'
					aria-label='Filtrar por origem'
					className={cn(
						'pressable flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold transition-colors hover:bg-accent',
						icon_only ? 'w-11' : 'px-4',
						origin && 'border-primary/60'
					)}
				>
					{icon_only && origin && <SourceIcon type={origin.type} className='size-4' />}
					{icon_only && !origin && <CreditCard className='size-4' />}
					{!icon_only && (
						<>
							<span className='max-w-[160px] truncate'>{origin ? origin.name : 'Todas as origens'}</span>
							<ChevronDown className='size-4 text-muted-foreground' />
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='max-h-80 w-60 overflow-y-auto'>
				<DropdownMenuItem onClick={() => setOrigin(null)}>
					<Check className={cn('mr-2 size-4', origin && 'opacity-0')} />
					Todas as origens
				</DropdownMenuItem>
				{[ 'Account', 'CreditBalance' ].map((type) => {
					const options = origin_options.filter((option) => option.type === type);
					if (!options.length) return null;
					return (
						<div key={type}>
							<DropdownMenuSeparator />
							<DropdownMenuLabel className='text-xs text-muted-foreground'>{type === 'Account' ? 'Contas' : 'Cartões'}</DropdownMenuLabel>
							{options.map((option) => (
								<DropdownMenuItem key={option.id} onClick={() => setOrigin(option)}>
									<Check className={cn('mr-2 size-4', origin?.id !== option.id && 'opacity-0')} />
									<span className='truncate'>{option.name}</span>
								</DropdownMenuItem>
							))}
						</div>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	const searchInput = (autofocus: boolean) => (
		<label className='flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
			<Search className='size-4 shrink-0 text-muted-foreground' />
			<input
				autoFocus={autofocus}
				type='search'
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder='Buscar recorrência'
				aria-label='Buscar recorrência'
				className='min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground'
			/>
			{search && (
				<button type='button' aria-label='Limpar busca' onClick={() => setSearch('')} className='text-muted-foreground hover:text-foreground'>
					<X className='size-4' />
				</button>
			)}
		</label>
	);

	/* ---------- Resumo das recorrentes (por mês) ---------- */
	const monthly = recurring.filter((item) => !isEnded(item) && item.frequency === 'monthly' && item.interval === 1);
	const monthly_out = monthly.filter((item) => item.kind === 'withdraw');
	const monthly_in = monthly.filter((item) => item.kind === 'deposit');
	const sum = (list: TRecurrence[]) => list.reduce((acc, item) => acc + item.value, 0);
	const names = (list: TRecurrence[]) => {
		const words = list.map((item) => item.description);
		if (words.length <= 1) return words.join('');
		if (words.length <= 3) return `${ words.slice(0, -1).join(', ') } e ${ words[words.length - 1] }`;
		return `${ words.slice(0, 2).join(', ') } e mais ${ words.length - 2 }`;
	};
	const estimated_count = recurring.filter((item) => !isEnded(item) && isEstimated(item)).length;
	/* Fora da conta: o que não é mensal e as transferências (não entram nem saem da carteira). */
	const left_out = recurring.filter((item) => !isEnded(item) && (!monthly.includes(item) || item.kind === 'transfer'));

	const recurringHero = (
		<section className={cn(HERO, 'p-5')}>
			<div aria-hidden='true' className={HERO_GLOW} />
			<div className='relative flex flex-col gap-4'>
				<div className='flex items-center justify-between gap-3'>
					<span className='text-[13px] font-medium text-[#A9B6BF]'>Por mês, nas recorrentes</span>
					{estimated_count > 0 && (
						<span className='rounded-full bg-[rgba(110,180,220,0.16)] px-2.5 py-0.5 text-xs font-semibold text-[#9CCBEA]'>
							{estimated_count} {estimated_count === 1 ? 'estimada' : 'estimadas'}
						</span>
					)}
				</div>
				<div className='grid grid-cols-2 gap-4 lg:grid-cols-1'>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<span className='text-xs text-[#A9B6BF]'>Sai</span>
						<span className='truncate text-[22px] font-semibold tracking-[-0.03em] text-[#F5A99F] md:text-2xl lg:text-[26px]'>
							{monthly_out.some(isEstimated) && '≈ '}− <span className='max-md:hidden'>R$ </span>{plainMoney(sum(monthly_out))}
						</span>
						<span className='truncate text-xs text-[#A9B6BF]'>{names(monthly_out) || 'nada por mês'}</span>
					</div>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<span className='text-xs text-[#A9B6BF]'>Entra</span>
						<span className='truncate text-[22px] font-semibold tracking-[-0.03em] text-[#9FE0B6] md:text-2xl lg:text-[26px]'>
							{monthly_in.some(isEstimated) && '≈ '}+ <span className='max-md:hidden'>R$ </span>{plainMoney(sum(monthly_in))}
						</span>
						<span className='truncate text-xs text-[#A9B6BF]'>{names(monthly_in) || 'nada por mês'}</span>
					</div>
				</div>
				{left_out.length > 0 && (
					<p className='border-t border-sand-light/10 pt-3 text-xs leading-relaxed text-[#A9B6BF]'>
						{names(left_out)} {left_out.length === 1 ? 'fica' : 'ficam'} fora desta conta (só entram as mensais, sem transferências).
					</p>
				)}
			</div>
		</section>
	);

	/* Próximas deste mês (a próxima de cada recorrente ativa). */
	const now = new Date();
	const today_year = now.getFullYear();
	const today_month = now.getMonth() + 1;
	const upcoming = recurring
		.filter((item) => item.next_occurrence)
		.filter((item) => {
			const [ year, month ] = ymdParts(item.next_occurrence!.transaction_date);
			return year === today_year && month === today_month;
		})
		.sort((a, b) => a.next_occurrence!.transaction_date.localeCompare(b.next_occurrence!.transaction_date));

	const upcomingCard = (
		<section className={cn(SURFACE, 'rounded-3xl p-5')}>
			<div className='mb-2 flex items-baseline justify-between'>
				<h3 className='text-[15px] font-bold'>Próximas</h3>
				<span className='text-xs text-muted-foreground'>{MONTH_NAMES_PT[today_month - 1]?.toLowerCase()}</span>
			</div>
			{upcoming.length === 0 && <p className='py-3 text-sm text-muted-foreground'>Nada mais previsto este mês.</p>}
			<ul className='flex flex-col divide-y divide-border'>
				{upcoming.slice(0, 6).map((item) => {
					const [ , , day ] = ymdParts(item.next_occurrence!.transaction_date);
					return (
						<li key={item.id}>
							<button type='button' onClick={() => setEditing(item)} className='pressable flex w-full items-center gap-3 py-2.5 text-left'>
								<span className='flex w-8 shrink-0 flex-col items-center leading-none'>
									<span className='text-base font-bold'>{day}</span>
									<span className='text-[11px] text-muted-foreground'>{monthShort(today_month)}</span>
								</span>
								<span className='flex min-w-0 flex-1 flex-col'>
									<span className='truncate text-sm font-semibold'>{item.description}</span>
									<span className='truncate text-xs text-muted-foreground'>{item.source_name}</span>
								</span>
								<span className={cn('shrink-0 text-sm font-semibold', KIND_VISUAL[item.kind].value)}>{valueText(item)}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);

	/* ---------- Linhas (celular) ---------- */
	const recurringRow = (item: TRecurrence) => {
		const visual = KIND_VISUAL[item.kind];
		const Icon = visual.icon;
		const ended = isEnded(item);
		return (
			<li key={item.id}>
				<button type='button' onClick={() => setEditing(item)} className='pressable flex w-full items-center gap-3 px-4 py-3.5 text-left'>
					<span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', ended ? 'bg-secondary text-muted-foreground' : visual.tile)}>
						<Icon className='size-[18px]' />
					</span>
					<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
						<span className='flex min-w-0 items-center gap-2'>
							<span className={cn('truncate font-semibold', ended && 'text-muted-foreground')}>{item.description}</span>
							{ended && <Badge variant='neutral' className='shrink-0'>Encerrada</Badge>}
						</span>
						<span className='flex min-w-0 items-center gap-1 text-xs text-muted-foreground'>
							<span className='shrink-0'>{RecurrenceUtils.frequencyLabel(item)} ·</span>
							<SourceIcon type={item.source_type} className='size-3 shrink-0' />
							<span className='truncate'>{item.source_name}</span>
						</span>
					</span>
					<span className='flex shrink-0 flex-col items-end gap-0.5'>
						<span className={cn('font-semibold', ended ? 'text-muted-foreground' : visual.value)}>{valueText(item)}</span>
						<span className='text-xs text-muted-foreground'>
							{ended && 'sem próxima'}
							{!ended && isEstimated(item) && <><span className='font-semibold text-info'>estimado</span> · {dayMonth(item.next_occurrence!.transaction_date)}</>}
							{!ended && !isEstimated(item) && `próx. ${ dayMonth(item.next_occurrence!.transaction_date) }`}
						</span>
					</span>
				</button>
			</li>
		);
	};

	/* ---------- Tabela (tablet em diante) ---------- */
	const recurringTableRow = (item: TRecurrence) => {
		const visual = KIND_VISUAL[item.kind];
		const Icon = visual.icon;
		const ended = isEnded(item);
		return (
			<tr key={item.id} className='group border-t border-border'>
				<td className='py-3 pl-4 pr-3'>
					<button type='button' onClick={() => setEditing(item)} className='flex w-full min-w-0 items-center gap-3 text-left'>
						<span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', ended ? 'bg-secondary text-muted-foreground' : visual.tile)}>
							<Icon className='size-4' />
						</span>
						<span className='flex min-w-0 flex-col'>
							<span className='flex min-w-0 items-center gap-2'>
								<span className={cn('truncate font-semibold', ended && 'text-muted-foreground')}>{item.description}</span>
								{ended && <Badge variant='neutral' className='shrink-0'>Encerrada</Badge>}
								{!ended && isEstimated(item) && <Badge variant='info' className='shrink-0'>Estimado</Badge>}
								{item.origin === 'bank' && <Badge variant='brand' className='shrink-0'><Link2 className='size-3' />do banco</Badge>}
							</span>
							<span className='truncate text-xs text-muted-foreground'>
								{ruleText(item)}
								{ended && item.end_date && ` · terminou em ${ monthYear(ymdParts(item.end_date)[0], ymdParts(item.end_date)[1]) }`}
							</span>
							{/* Nos tablets a origem vai embaixo do nome (a coluna dela só cabe no desktop). */}
							<span className='flex items-center gap-1 text-xs text-muted-foreground xl:hidden'>
								<SourceIcon type={item.source_type} className='size-3' />
								<span className='truncate'>{item.source_name}</span>
							</span>
						</span>
					</button>
				</td>
				<td className='hidden max-w-[180px] px-3 py-3 xl:table-cell'>
					<span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
						<SourceIcon type={item.source_type} className='size-3.5 shrink-0' />
						<span className='truncate'>{item.source_name}</span>
					</span>
				</td>
				<td className='whitespace-nowrap px-3 py-3'>
					{ended
						? <span className='text-muted-foreground'>—</span>
						: (
							<span className='flex flex-col'>
								<span className='text-sm font-semibold'>{dayMonth(item.next_occurrence!.transaction_date)}</span>
								<span className={cn('text-xs', isEstimated(item) ? 'font-semibold text-info' : 'text-muted-foreground')}>
									{isEstimated(item) ? 'estimado' : 'valor fixo'}
								</span>
							</span>
						)}
				</td>
				<td className={cn('whitespace-nowrap px-3 py-3 text-right font-semibold', ended ? 'text-muted-foreground' : visual.value)}>
					{valueText(item)}
				</td>
				<td className='w-10 py-3 pr-3'>{actionsMenu(item)}</td>
			</tr>
		);
	};

	/* ---------- Parceladas ---------- */
	const active_installments = installments.filter((item) => !isEnded(item));
	const progress_of = new Map(installments.map((item) => [ item.id, installmentProgress(item) ]));
	const remaining_total = active_installments.reduce((acc, item) => acc + (progress_of.get(item.id)?.remaining ?? 0), 0);
	const monthly_installments = active_installments.reduce((acc, item) => acc + item.value, 0);
	const ends = active_installments.map((item) => progress_of.get(item.id)!);
	const last_end = ends.reduce<ReturnType<typeof installmentProgress> | null>((acc, item) => (!acc || item.end_key > acc.end_key ? item : acc), null);
	const first_end = ends.reduce<ReturnType<typeof installmentProgress> | null>((acc, item) => (!acc || item.end_key < acc.end_key ? item : acc), null);
	const installment_sources = Array.from(new Set(active_installments.map((item) => item.source_name)));
	const [ remaining_main, remaining_cents ] = splitCents(MoneyUtils.formatMoney(remaining_total));

	const installmentHero = (
		<section className={cn(HERO, 'p-5 md:p-6')}>
			<div aria-hidden='true' className={HERO_GLOW} />
			<div className='relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between'>
				<div className='flex flex-col gap-1.5'>
					<span className='text-[13px] font-medium text-[#A9B6BF]'>Falta pagar · compras parceladas</span>
					<span className='text-[36px] font-semibold leading-none tracking-[-0.045em] md:text-[44px]'>
						{remaining_main}<span className='text-[#7F919C]'>{remaining_cents}</span>
					</span>
					<span className='text-[13px] text-[#A9B6BF]'>
						{active_installments.length} em andamento{last_end && ` · a última termina em ${ last_end.end_label }`}
					</span>
				</div>
				{active_installments.length > 0 && (
					<div className='grid grid-cols-2 gap-4 border-t border-sand-light/10 pt-4 xl:flex xl:gap-10 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0'>
						<div className='flex flex-col gap-0.5'>
							<span className='text-xs text-[#A9B6BF]'>Por mês nas faturas</span>
							<span className='text-xl font-semibold tracking-[-0.03em] md:text-2xl'>{MoneyUtils.formatMoney(monthly_installments)}</span>
							{first_end && <span className='text-xs text-[#A9B6BF]'>até {first_end.end_label}</span>}
						</div>
						<div className='flex min-w-0 flex-col gap-0.5'>
							<span className='text-xs text-[#A9B6BF]'>Em andamento</span>
							<span className='text-xl font-semibold tracking-[-0.03em] md:text-2xl'>
								{active_installments.length} {active_installments.length === 1 ? 'compra' : 'compras'}
							</span>
							<span className='truncate text-xs text-[#A9B6BF]'>{installment_sources.join(' e ')}</span>
						</div>
					</div>
				)}
			</div>
		</section>
	);

	const installmentCard = (item: TRecurrence) => {
		const progress = progress_of.get(item.id)!;
		const ended = isEnded(item);
		const segmented = progress.total_count > 0 && progress.total_count <= 24;
		return (
			<article
				key={item.id}
				className={cn('flex flex-col gap-4 rounded-3xl p-5', ended ? 'border border-dashed border-border' : SURFACE)}
			>
				<header className='flex items-start gap-3'>
					<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground'>
						<CreditCard className='size-[18px]' />
					</span>
					<button type='button' onClick={() => setEditing(item)} className='flex min-w-0 flex-1 flex-col text-left'>
						<span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
							<span className={cn('font-bold', ended && 'text-muted-foreground')}>{item.description}</span>
							{item.origin === 'bank' && <Badge variant='brand'><Link2 className='size-3' />do banco</Badge>}
							{ended && <Badge variant='neutral'>Encerrada</Badge>}
						</span>
						<span className='truncate text-xs text-muted-foreground'>{item.source_name}</span>
					</button>
					{actionsMenu(item)}
				</header>

				<div className='flex flex-col gap-1'>
					<span className={cn('flex items-baseline gap-1.5', ended && 'text-muted-foreground')}>
						<span className='text-sm text-muted-foreground'>{progress.total_count}x</span>
						<span className='text-[28px] font-semibold leading-none tracking-[-0.04em]'>{MoneyUtils.formatMoney(item.value)}</span>
					</span>
					{progress.has_extra && !ended && (
						<span className='text-xs text-muted-foreground'>1ª parcela de {MoneyUtils.formatMoney(progress.first_value)}</span>
					)}
				</div>

				<div className='flex flex-col gap-2'>
					{segmented
						? (
							<div className='flex gap-1' aria-hidden='true'>
								{Array.from({ length: progress.total_count }).map((_, index) => (
									<span key={index} className={cn('h-1.5 flex-1 rounded-full', index < progress.done && !ended ? 'bg-primary' : 'bg-secondary', ended && 'bg-muted-foreground/30')} />
								))}
							</div>
						)
						: (
							<div className='h-1.5 overflow-hidden rounded-full bg-secondary' aria-hidden='true'>
								<div className='h-full rounded-full bg-primary' style={{ width: `${ (progress.done / Math.max(1, progress.total_count)) * 100 }%` }} />
							</div>
						)}
					<span className='flex justify-between text-xs'>
						<span className='font-bold'>{progress.done} de {progress.total_count} pagas</span>
						<span className='font-semibold text-muted-foreground'>{ended ? 'quitada' : `faltam ${ progress.left }`}</span>
					</span>
				</div>

				<div className='grid grid-cols-2 gap-3 border-t border-border pt-3'>
					{ended
						? (
							<>
								<div className='flex flex-col'>
									<span className='text-xs text-muted-foreground'>Total da compra</span>
									<span className='font-semibold text-muted-foreground'>{MoneyUtils.formatMoney(progress.total_value)}</span>
								</div>
								<div className='flex flex-col'>
									<span className='text-xs text-muted-foreground'>Última parcela</span>
									<span className='font-semibold text-muted-foreground'>{progress.end_label}</span>
								</div>
							</>
						)
						: (
							<>
								<div className='flex flex-col'>
									<span className='text-xs text-muted-foreground'>Falta pagar</span>
									<span className='font-bold'>{MoneyUtils.formatMoney(progress.remaining)}</span>
									<span className='text-xs text-muted-foreground'>termina {progress.end_label}</span>
								</div>
								<div className='flex flex-col'>
									<span className='text-xs text-muted-foreground'>Total da compra</span>
									<span className='font-bold'>{MoneyUtils.formatMoney(progress.total_value)}</span>
									<span className='text-xs text-muted-foreground'>próxima {dayMonth(item.next_occurrence!.transaction_date)}</span>
								</div>
							</>
						)}
				</div>
			</article>
		);
	};

	/* ---------- Estados vazios ---------- */
	const empty = (
		<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
			<Repeat className='size-9 text-muted-foreground' />
			<div className='flex flex-col gap-1'>
				<span className='font-semibold'>
					{has_filter && 'Nada encontrado'}
					{!has_filter && (recurrence_type === 'installment' ? 'Nenhuma compra parcelada' : 'Nenhuma recorrência')}
				</span>
				<span className='text-sm text-muted-foreground'>
					{has_filter ? 'Tente outra busca ou outra origem.' : 'Crie uma em "Nova recorrência" ou ao lançar uma transação, em Repetir.'}
				</span>
			</div>
		</div>
	);

	const skeleton = (
		<div className='flex flex-col gap-2'>
			{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className='h-16 w-full rounded-2xl' />)}
		</div>
	);

	return (
		<div className='flex flex-col gap-4'>
			{recurrence_type === 'installment' && installments.length > 0 && installmentHero}
			{recurrence_type === 'recurring' && recurring.length > 0 && <div className='lg:hidden'>{recurringHero}</div>}

			<div className='flex flex-col gap-4 lg:flex-row lg:items-start'>
				<div className={cn('flex min-w-0 flex-1 flex-col gap-3', recurrence_type === 'recurring' && 'lg:rounded-3xl lg:border lg:border-border lg:p-4')}>
					{/* Barra: tipo + busca + origem */}
					<div className='flex items-center gap-2'>
						<SegmentedControl
							segments={segments}
							value={recurrence_type}
							onChange={(next) => setRecurrenceType(next as TRecurrenceType)}
							className='shrink-0'
						/>
						<div className='hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex'>
							<div className='flex w-full max-w-[300px] min-w-0'>{searchInput(false)}</div>
							<span className='xl:hidden'>{originFilter(true)}</span>
							<span className='hidden xl:block'>{originFilter(false)}</span>
						</div>
						<div className='ml-auto flex items-center gap-2 md:hidden'>
							<button
								type='button'
								aria-label={search_open ? 'Fechar busca' : 'Buscar'}
								onClick={() => setSearchOpen(!search_open)}
								className={cn('pressable flex size-11 items-center justify-center rounded-full border border-border bg-card', (search_open || has_filter) && 'border-primary/60')}
							>
								{search_open ? <X className='size-4' /> : <Search className='size-4' />}
							</button>
						</div>
					</div>
					{search_open && (
						<div className='flex items-center gap-2 md:hidden'>
							{searchInput(true)}
							{originFilter(true)}
						</div>
					)}

					{is_loading && skeleton}
					{!is_loading && sorted.length === 0 && empty}

					{!is_loading && sorted.length > 0 && recurrence_type === 'recurring' && (
						<>
							<ul className={cn(SURFACE, 'flex flex-col divide-y divide-border overflow-hidden rounded-3xl md:hidden')}>
								{sorted.map(recurringRow)}
							</ul>
							<div className={cn(SURFACE, 'hidden overflow-hidden rounded-3xl md:block lg:border-0 lg:bg-transparent lg:shadow-none dark:lg:bg-transparent')}>
								<table className='w-full table-fixed text-sm'>
									<thead>
										<tr className='text-left text-xs text-muted-foreground'>
											<th className='py-2.5 pl-4 pr-3 font-medium'>Recorrência</th>
											<th className='hidden w-[170px] px-3 py-2.5 font-medium xl:table-cell'>Origem</th>
											<th className='w-[96px] px-3 py-2.5 font-medium'>Próxima</th>
											<th className='w-[130px] px-3 py-2.5 text-right font-medium'>Valor</th>
											<th className='w-10' />
										</tr>
									</thead>
									<tbody>{sorted.map(recurringTableRow)}</tbody>
								</table>
							</div>
						</>
					)}

					{!is_loading && sorted.length > 0 && recurrence_type === 'installment' && (
						<>
							<div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'>{sorted.map(installmentCard)}</div>
							<p className='flex items-start gap-2.5 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground'>
								<Info className='mt-0.5 size-4 shrink-0' />
								Também dá para parcelar direto no formulário de transação, em Repetir → Parcelado. As compras parceladas do banco chegam sozinhas com a sincronização.
							</p>
						</>
					)}
				</div>

				{recurrence_type === 'recurring' && recurring.length > 0 && (
					<aside className='hidden w-[320px] shrink-0 flex-col gap-4 lg:flex'>
						{recurringHero}
						{upcomingCard}
					</aside>
				)}
			</div>

			<RecurrenceFormDialog
				open={Boolean(editing)}
				onOpenChange={(open) => !open && setEditing(null)}
				recurrence={editing}
				onDelete={() => editing && setDeleting(editing)}
			/>

			<TransactionFormDialog
				open={creating}
				onOpenChange={onCreatingChange}
				defaultRepeatMode={recurrence_type}
				defaultSourceType={origin?.type}
				defaultSourceId={origin?.id}
			/>

			<AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{deleting?.recurrence_type === 'installment' ? 'Excluir compra parcelada' : 'Excluir recorrência'}</AlertDialogTitle>
						<AlertDialogDescription>
							Excluir "{deleting?.description}"? As previstas de hoje em diante serão removidas. As já lançadas ficam.
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

export default RecurrenceList;
