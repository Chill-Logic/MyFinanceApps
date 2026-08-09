import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, TransactionUtils, type TTransaction, type TTransactionGroup } from '@myfinance/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
	ArrowDown,
	ArrowDownRight,
	ArrowUp,
	ArrowUpDown,
	ArrowUpRight,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleDashed,
	CreditCard,
	Loader2,
	MoreVertical,
	Plus,
	Receipt,
	User,
	Wallet,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteTransactions } from '@/hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import useToast from '@/hooks/useToast';

import { useMonthSelection } from '@/context/monthSelection';
import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import DateTimeField from '@/components/molecules/DateTimeField';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TSortField = 'transaction_date' | 'description' | 'kind' | 'value';
type TSortState = { field: TSortField; direction: 'asc' | 'desc' };
type TCreditSection = { id: string; name: string; items: TTransaction[] };

const groupLabel = (date: Date) => {
	if (isToday(date)) return 'Hoje';
	if (isYesterday(date)) return 'Ontem';
	return format(date, 'd \'de\' MMMM', { locale: ptBR });
};

const groupTransactionsByDay = (transactions: TTransaction[]) => {
	const groups = new Map<string, { label: string; items: TTransaction[] }>();

	transactions.forEach((transaction_item) => {
		const date = new Date(TransactionUtils.effectiveDate(transaction_item));
		const key = format(date, 'yyyy-MM-dd');

		if (!groups.has(key)) {
			groups.set(key, { label: groupLabel(date), items: [] });
		}
		groups.get(key)!.items.push(transaction_item);
	});

	return Array.from(groups.values());
};

/*
 * Resumo do card de total. Aqui é SEMPRE das contas (`accounts`), o único fluxo de caixa real: combinar
 * contas + créditos duplicaria a saída, porque o pagamento da fatura já é um `withdraw` em `accounts` e as
 * compras são `withdraw` em `credits`.
 *
 * Efetivado/previsto vêm PRONTOS do backend (`total_settled`/`total_projected` do grupo) — não recalculamos
 * (evita divergir da fonte). Só o split entradas/saídas e a contagem de pendentes saem da lista no cliente,
 * porque o backend não os devolve.
 */
const buildSummary = (group: TTransactionGroup | undefined) => {
	const non_draft = (group?.data || []).filter((item) => !item.draft);

	const deposit = non_draft.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0);
	const withdraw = non_draft.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0);
	const settled = group?.total_settled ?? 0;
	const projected = group?.total_projected ?? 0;
	const pending = non_draft.filter((i) => !i.settled).length;

	return {
		deposit,
		withdraw,
		settled,
		projected,
		gap: projected !== settled,
		pending_suffix: pending > 0 ? ` · ${ pending } pendente${ pending > 1 ? 's' : '' }` : '',
	};
};

/* Saldo líquido (entradas - saídas) de uma seção, ignorando rascunhos — usado no subtotal do cartão. */
const sectionNet = (items: TTransaction[]) =>
	items
		.filter((item) => !item.draft)
		.reduce((acc, item) => acc + (item.kind === 'deposit' ? item.value : -item.value), 0);

const formatDateTime = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm');

const sortTransactions = (transactions: TTransaction[], sort: TSortState) => {
	const sign = sort.direction === 'asc' ? 1 : -1;

	return [ ...transactions ].sort((a, b) => {
		if (sort.field === 'transaction_date') {
			return sign * (new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
		}
		if (sort.field === 'value') {
			return sign * (a.value - b.value);
		}
		return sign * a[sort.field].localeCompare(b[sort.field]);
	});
};

const TransactionList = () => {
	const navigate = useNavigate();
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const { month_year, setMonthYear } = useMonthSelection();
	const [ editing_transaction, setEditingTransaction ] = useState<TTransaction | null>(null);
	const [ deleting_transaction, setDeletingTransaction ] = useState<TTransaction | null>(null);
	/* Transação sendo efetivada no modal de "Efetivar pagamento" + a data/hora escolhida. */
	const [ settling_transaction, setSettlingTransaction ] = useState<TTransaction | null>(null);
	const [ settle_date, setSettleDate ] = useState<Date>(new Date());
	const [ sort, setSort ] = useState<TSortState>({ field: 'transaction_date', direction: 'desc' });
	/* IDs de cartão expandidos (fora do Set = fechado, que é o padrão — accordions nascem fechados). */
	const [ expanded, setExpanded ] = useState<Set<string>>(new Set());

	const wallet_id = user_wallet.data?.id;
	const reference = `${ month_year.year }-${ String(month_year.month + 1).padStart(2, '0') }`;

	// Uma única busca: o mês inteiro (contas + créditos vêm separados na resposta).
	const { data: data_all, isLoading: is_transactions_loading } = useListTransactions({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '', reference },
	});

	/* Contas/créditos: pra resolver o nome da origem de cada linha e pra guiar o empty-state. */
	const { data: accounts_data, isLoading: is_accounts_loading } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });
	const { data: credit_balances_data, isLoading: is_credit_loading } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });

	const accounts = accounts_data?.data || [];
	const credit_balances = credit_balances_data?.data || [];

	const source_names = useMemo(() => {
		const map = new Map<string, string>();
		accounts.forEach((account) => map.set(account.id, account.name));
		credit_balances.forEach((credit_balance) => map.set(credit_balance.id, credit_balance.name));
		return map;
	}, [ accounts, credit_balances ]);

	const is_loading = is_wallet_loading || is_transactions_loading || is_accounts_loading || is_credit_loading;

	const { mutate: deleteTransactionMutation, isPending: is_delete_pending } = useDeleteTransactions();
	const { mutate: updateTransactionMutation, isPending: is_settle_pending } = useUpdateTransactions();

	/*
	 * O backend já separa em `accounts` (bucket mês-calendário) e `credits` (bucket ciclo da fatura).
	 * Agora exibimos TUDO numa tela só (sem abas): as transações de conta ficam soltas ("jogadas") e as
	 * de crédito são agrupadas por `source_id` (uma seção colapsável por cartão).
	 */
	const account_txs = useMemo(() => data_all?.accounts.data || [], [ data_all ]);
	const credit_txs = useMemo(() => data_all?.credits.data || [], [ data_all ]);

	const credit_sections = useMemo<TCreditSection[]>(() => {
		const map = new Map<string, TTransaction[]>();
		credit_txs.forEach((transaction_item) => {
			const list = map.get(transaction_item.source_id) || [];
			list.push(transaction_item);
			map.set(transaction_item.source_id, list);
		});

		const ordered: TCreditSection[] = [];
		// Ordena pela ordem das linhas de crédito; o que sobrar (origem não listada) vai no fim.
		credit_balances.forEach((credit_balance) => {
			const items = map.get(credit_balance.id);
			if (items) {
				ordered.push({ id: credit_balance.id, name: credit_balance.name, items });
				map.delete(credit_balance.id);
			}
		});
		map.forEach((items, id) => ordered.push({ id, name: source_names.get(id) || 'Crédito', items }));
		return ordered;
	}, [ credit_txs, credit_balances, source_names ]);

	const summary = buildSummary(data_all?.accounts); // total do mês = SÓ contas (fluxo de caixa real)

	const has_transactions = account_txs.length + credit_txs.length > 0;
	const has_sources = accounts.length > 0 || credit_balances.length > 0;

	const changeMonth = (offset: number) => {
		const date = new Date(month_year.year, month_year.month + offset, 1);
		setMonthYear({ month: date.getMonth(), year: date.getFullYear() });
	};

	const toggleExpanded = (id: string) => {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSort = (field: TSortField) => {
		setSort((current) => (
			current.field === field
				? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
				: { field, direction: 'asc' }
		));
	};

	const renderSortIcon = (field: TSortField) => {
		if (sort.field !== field) return <ArrowUpDown className='h-3 w-3 opacity-50' />;
		return sort.direction === 'asc' ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' />;
	};

	const isFormOpen = is_new_transaction_open || Boolean(editing_transaction);

	const handleFormOpenChange = (open: boolean) => {
		if (!open) {
			setIsNewTransactionOpen(false);
			setEditingTransaction(null);
		}
	};

	const handleConfirmDelete = () => {
		if (!deleting_transaction) return;

		deleteTransactionMutation({
			id: deleting_transaction.id,
			onSuccess: () => {
				toast.success('Transação excluída com sucesso');
				setDeletingTransaction(null);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível excluir a transação')),
		});
	};

	/* Desfazer também é só um UPDATE (`settled_date: null` = volta pra pendente) — sem endpoint /unsettle. */
	const handleUnsettle = (transaction_item: TTransaction) => {
		updateTransactionMutation({
			id: transaction_item.id,
			body: { settled_date: null },
			onSuccess: () => toast.success('Efetivação desfeita'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível desfazer')),
		});
	};

	/* Abre o modal de "Efetivar pagamento" com a data/hora pré-preenchida no momento atual. */
	const openSettle = (transaction_item: TTransaction) => {
		setSettleDate(new Date());
		setSettlingTransaction(transaction_item);
	};

	/* Efetiva via UPDATE com body só do `settled_date` (não usa o endpoint /settle). */
	const handleConfirmSettle = () => {
		if (!settling_transaction) return;

		updateTransactionMutation({
			id: settling_transaction.id,
			body: { settled_date: settle_date.toISOString() },
			onSuccess: () => {
				toast.success('Pagamento efetivado');
				setSettlingTransaction(null);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível efetivar')),
		});
	};

	const renderKindIcon = (transaction_item: TTransaction) => {
		const is_deposit = transaction_item.kind === 'deposit';

		return (
			<div
				className={cn(
					'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
					is_deposit ? 'bg-feedback-success-light text-feedback-success-dark' : 'bg-feedback-danger-light text-feedback-danger-dark',
				)}
			>
				{is_deposit ? <ArrowUpRight className='h-4 w-4' /> : <ArrowDownRight className='h-4 w-4' />}
			</div>
		);
	};

	/*
	 * Chip do NOME da origem (omitido dentro de uma seção de cartão via `hide_source` — o header já diz),
	 * badges de estado (pendente/rascunho) e QUEM fez a transação (`user_name`, sempre visível).
	 */
	const renderMeta = (transaction_item: TTransaction, hide_source = false) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const name = source_names.get(transaction_item.source_id);
		const is_pending = !transaction_item.draft && !transaction_item.settled;

		return (
			<div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
				{!hide_source && (
					<span
						className={cn(
							'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
							is_credit ? 'border-feedback-info-default/50 text-feedback-info-default' : 'border-brand-secondary/50 text-brand-secondary',
						)}
					>
						{is_credit ? <CreditCard className='h-3 w-3' /> : <Wallet className='h-3 w-3' />}
						{name || (is_credit ? 'Crédito' : 'Conta')}
					</span>
				)}

				{transaction_item.draft && (
					<span className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground'>Rascunho</span>
				)}
				{is_pending && (
					<span className='rounded bg-feedback-warning-light px-1.5 py-0.5 text-[10px] font-semibold uppercase text-feedback-warning-dark'>Pendente</span>
				)}

				<span className='inline-flex items-center gap-1 text-[11px] text-muted-foreground'>
					<User className='h-3 w-3' />
					{transaction_item.user_name}
				</span>
			</div>
		);
	};

	/*
	 * Linha de data/hora: "Prevista" (transaction_date) + "Pago" (settled_date, quando efetivada). Em
	 * crédito não mostramos a "Prevista" — a compra é auto-efetivada (settled_date = transaction_date),
	 * então só o "Pago" é relevante.
	 */
	const renderDates = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';

		return (
			<div className='mt-1 flex flex-col text-[11px] leading-tight text-muted-foreground'>
				{!is_credit && <span>Prevista: {formatDateTime(transaction_item.transaction_date)}</span>}
				{transaction_item.settled_date && <span>Pago: {formatDateTime(transaction_item.settled_date)}</span>}
			</div>
		);
	};

	const renderEntry = (Icon: typeof ArrowUpRight, badgeClass: string, valueClass: string, value: number) => (
		<div className='flex items-center gap-1.5 text-sm'>
			<span className={cn('flex h-6 w-6 items-center justify-center rounded-full', badgeClass)}>
				<Icon className='h-3.5 w-3.5' />
			</span>
			<span className={cn('font-medium', valueClass)}>{MoneyUtils.formatMoney(value)}</span>
		</div>
	);

	/*
	 * Card de total do mês: SÓ contas (fluxo de caixa real). Não combina crédito — ver comentário do
	 * `buildSummary`. Entrada/saída podem quebrar pra baixo em telas estreitas (flex-wrap).
	 */
	const renderTotals = () => (
		<div className='rounded-lg border border-card bg-card px-4 py-3'>
			<div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2'>
				<div className='flex flex-col'>
					<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						Total do mês · Contas
					</span>
					{is_loading ? (
						<Skeleton className='h-5 w-28' />
					) : (
						<div className='flex flex-wrap items-baseline gap-x-2'>
							<span className={cn('text-base font-semibold', summary.settled >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
								{MoneyUtils.formatSignedMoney(summary.settled)}
							</span>
							<span className='text-xs text-muted-foreground'>
								previsto <span className={cn('font-medium', summary.gap ? 'text-feedback-warning-dark' : 'text-foreground')}>{MoneyUtils.formatSignedMoney(summary.projected)}</span>
								{summary.pending_suffix}
							</span>
						</div>
					)}
				</div>

				<div className='flex items-center gap-6'>
					{renderEntry(ArrowUpRight, 'bg-feedback-success-light text-feedback-success-dark', 'text-feedback-success-default', summary.deposit)}
					{renderEntry(ArrowDownRight, 'bg-feedback-danger-light text-feedback-danger-dark', 'text-destructive', summary.withdraw)}
				</div>
			</div>
		</div>
	);

	const renderActionsMenu = (transaction_item: TTransaction) => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type='button' variant='ghost' size='icon' aria-label='Ações da transação'>
					<MoreVertical className='h-4 w-4' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{!transaction_item.draft && (
					transaction_item.settled
						? (
							<DropdownMenuItem onClick={() => handleUnsettle(transaction_item)}>
								<CircleDashed className='mr-2 h-4 w-4' /> Desfazer efetivação
							</DropdownMenuItem>
						)
						: (
							<DropdownMenuItem onClick={() => openSettle(transaction_item)}>
								<CheckCircle2 className='mr-2 h-4 w-4' /> Efetivar pagamento
							</DropdownMenuItem>
						)
				)}
				<DropdownMenuItem onClick={() => setEditingTransaction(transaction_item)}>
					Editar
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className='text-destructive' onClick={() => setDeletingTransaction(transaction_item)}>
					Excluir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	/* ----- Desktop: linhas da tabela ----- */
	const renderTableRow = (transaction_item: TTransaction, hide_source = false) => {
		const is_deposit = transaction_item.kind === 'deposit';

		return (
			<TableRow key={transaction_item.id} className={cn(transaction_item.draft && 'opacity-60')}>
				<TableCell className='text-muted-foreground'>
					<div className='flex flex-col leading-tight'>
						<span>{formatDateTime(transaction_item.transaction_date)}</span>
						{transaction_item.settled_date && (
							<span className='text-xs text-feedback-success-default'>pago {formatDateTime(transaction_item.settled_date)}</span>
						)}
					</div>
				</TableCell>
				<TableCell>
					<div className='flex flex-col'>
						<span className='font-medium'>{transaction_item.description}</span>
						{renderMeta(transaction_item, hide_source)}
					</div>
				</TableCell>
				<TableCell>{renderKindIcon(transaction_item)}</TableCell>
				<TableCell className={cn('text-right font-semibold', is_deposit ? 'text-feedback-success-default' : 'text-destructive')}>
					{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
				</TableCell>
				<TableCell>{renderActionsMenu(transaction_item)}</TableCell>
			</TableRow>
		);
	};

	/*
	 * Accordion de um cartão (usado no desktop — coluna direita — e no mobile): header com a altura de um
	 * card de transação + body em cor distinta, animado (grid-rows) e com scroll interno (max-h).
	 */
	const renderCreditAccordion = (section: TCreditSection) => {
		const is_collapsed = !expanded.has(section.id);
		const net = sectionNet(section.items);

		return (
			<div key={section.id} className='overflow-hidden rounded-xl border border-card'>
				<button
					type='button'
					onClick={() => toggleExpanded(section.id)}
					className='flex w-full items-center justify-between gap-3 bg-card p-3 text-left'
				>
					<span className='flex items-center gap-3 overflow-hidden'>
						<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-feedback-info-light text-feedback-info-default'>
							<CreditCard className='h-4 w-4' />
						</span>
						<span className='flex flex-col overflow-hidden'>
							<span className='truncate text-sm font-medium'>{section.name}</span>
							<span className='text-xs text-muted-foreground'>
								{section.items.length} transaç{section.items.length === 1 ? 'ão' : 'ões'}
							</span>
						</span>
					</span>
					<span className='flex shrink-0 items-center gap-2'>
						<span className={cn('text-sm font-semibold', net >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
							{MoneyUtils.formatSignedMoney(net)}
						</span>
						<ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-300', is_collapsed && '-rotate-90')} />
					</span>
				</button>

				{/* Animação de altura via grid-rows (0fr↔1fr) — sem JS, funciona com o estado `collapsed` */}
				<div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', is_collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
					<div className='overflow-hidden'>
						{/* Body em cor distinta + altura máxima com scroll interno (faturas com muitas linhas) */}
						<div className='flex max-h-80 flex-col gap-4 overflow-y-auto bg-muted/40 p-3'>{renderDayGroups(section.items, true)}</div>
					</div>
				</div>
			</div>
		);
	};

	/* ----- Mobile: card de transação ----- */
	const renderCard = (transaction_item: TTransaction, hide_source = false) => {
		const is_deposit = transaction_item.kind === 'deposit';

		return (
			<div
				key={transaction_item.id}
				className={cn('flex items-start gap-3 rounded-xl border border-card bg-card p-3', transaction_item.draft && 'opacity-60')}
			>
				{renderKindIcon(transaction_item)}

				<div className='flex flex-1 flex-col overflow-hidden'>
					<span className='truncate text-sm font-medium'>{transaction_item.description}</span>
					{renderMeta(transaction_item, hide_source)}
					{renderDates(transaction_item)}
				</div>

				<span className={cn('shrink-0 text-sm font-semibold', is_deposit ? 'text-feedback-success-default' : 'text-destructive')}>
					{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
				</span>

				{renderActionsMenu(transaction_item)}
			</div>
		);
	};

	const renderDayGroups = (items: TTransaction[], hide_source = false) =>
		groupTransactionsByDay(items).map((group) => (
			<div key={group.label} className='flex flex-col gap-2'>
				<span className='text-xs font-medium uppercase text-muted-foreground'>{group.label}</span>
				<div className='flex flex-col gap-2'>
					{group.items.map((transaction_item) => renderCard(transaction_item, hide_source))}
				</div>
			</div>
		));

	return (
		<div className='flex h-full flex-col gap-4'>
			<div className='flex flex-col gap-4'>
				{/* 1. Mês/ano (+ Nova Transação no desktop) — centralizado no mobile, à esquerda no desktop */}
				<div className='flex flex-wrap items-center justify-center gap-3 md:justify-start'>
					<div className='flex items-center gap-2'>
						<Button type='button' variant='outline' size='icon' onClick={() => changeMonth(-1)} aria-label='Mês anterior'>
							<ChevronLeft className='h-4 w-4' />
						</Button>
						<span className='w-36 text-center text-sm font-medium capitalize'>
							{format(new Date(month_year.year, month_year.month, 1), 'MMMM yyyy', { locale: ptBR })}
						</span>
						<Button type='button' variant='outline' size='icon' onClick={() => changeMonth(1)} aria-label='Próximo mês'>
							<ChevronRight className='h-4 w-4' />
						</Button>
					</div>

					{/* No mobile o "+" da bottom nav já cobre essa ação — duplicar aqui seria redundante */}
					<Button
						type='button'
						onClick={() => setIsNewTransactionOpen(true)}
						disabled={!wallet_id}
						className='hidden gap-2 md:ml-auto md:inline-flex'
					>
						<Plus className='h-4 w-4' />
						Nova Transação
					</Button>
				</div>

				{/* 2. Card de total do mês — só contas (fluxo de caixa real) */}
				{renderTotals()}
			</div>

			<div className='flex-1 overflow-y-auto'>
				{is_loading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className='h-14 w-full' />
						))}
					</div>
				)}

				{/* Sem nenhuma origem → manda cadastrar em Contas & Cartões */}
				{!is_loading && !has_transactions && !has_sources && (
					<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center'>
						<Wallet className='h-10 w-10 text-muted-foreground' />
						<div className='flex flex-col gap-1'>
							<span className='font-medium'>Nenhuma conta ou cartão ainda</span>
							<span className='text-sm text-muted-foreground'>
								Crie uma conta ou um cartão em Contas &amp; Cartões para ver as transações aqui.
							</span>
						</div>
						<Button type='button' variant='secondary' onClick={() => navigate('/accounts')} className='gap-2'>
							Ir para Contas &amp; Cartões
						</Button>
					</div>
				)}

				{!is_loading && !has_transactions && has_sources && (
					<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center'>
						<Receipt className='h-10 w-10 text-muted-foreground' />
						<div className='flex flex-col gap-1'>
							<span className='font-medium'>Nenhuma transação neste mês</span>
							<span className='text-sm text-muted-foreground'>Registre uma entrada ou saída pra começar</span>
						</div>
						<Button type='button' variant='secondary' onClick={() => setIsNewTransactionOpen(true)} disabled={!wallet_id} className='gap-2'>
							<Plus className='h-4 w-4' />
							Adicionar transação
						</Button>
					</div>
				)}

				{!is_loading && has_transactions && (
					<div className='mb-6'>
						{/* Desktop: 2 colunas — Contas (tabela ordenável, flat) | Cartões (accordions de cards) */}
						<div className='hidden gap-4 md:grid md:grid-cols-2'>
							<div className='flex flex-col gap-2'>
								<h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Contas</h3>
								{account_txs.length > 0 ? (
									<div className='overflow-hidden rounded-lg border border-card bg-card'>
										<Table>
											<TableHeader>
												<TableRow className='hover:bg-transparent'>
													<TableHead className='w-40'>
														<button type='button' onClick={() => toggleSort('transaction_date')} className='flex items-center gap-1 hover:text-foreground'>
															Data {renderSortIcon('transaction_date')}
														</button>
													</TableHead>
													<TableHead>
														<button type='button' onClick={() => toggleSort('description')} className='flex items-center gap-1 hover:text-foreground'>
															Descrição {renderSortIcon('description')}
														</button>
													</TableHead>
													<TableHead className='w-16'>
														<button type='button' onClick={() => toggleSort('kind')} className='flex items-center gap-1 hover:text-foreground'>
															Tipo {renderSortIcon('kind')}
														</button>
													</TableHead>
													<TableHead className='w-32 text-right'>
														<button type='button' onClick={() => toggleSort('value')} className='ml-auto flex items-center gap-1 hover:text-foreground'>
															Valor {renderSortIcon('value')}
														</button>
													</TableHead>
													<TableHead className='w-10' />
												</TableRow>
											</TableHeader>
											<TableBody>
												{sortTransactions(account_txs, sort).map((transaction_item) => renderTableRow(transaction_item))}
											</TableBody>
										</Table>
									</div>
								) : (
									<p className='rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
										Nenhuma transação em contas neste mês
									</p>
								)}
							</div>

							<div className='flex flex-col gap-2'>
								<h3 className='px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Cartões</h3>
								{credit_sections.length > 0 ? (
									<div className='flex flex-col gap-3'>{credit_sections.map(renderCreditAccordion)}</div>
								) : (
									<p className='rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
										Nenhuma fatura neste mês
									</p>
								)}
							</div>
						</div>

						{/* Mobile: empilhado — contas agrupadas por dia + accordions de cartão */}
						<div className='flex flex-col gap-4 md:hidden'>
							{account_txs.length > 0 && renderDayGroups(account_txs)}
							{credit_sections.map(renderCreditAccordion)}
						</div>
					</div>
				)}
			</div>

			<TransactionFormDialog
				open={isFormOpen}
				onOpenChange={handleFormOpenChange}
				transaction={editing_transaction}
				suggestedDate={new Date(month_year.year, month_year.month, new Date().getDate())}
			/>

			<AlertDialog open={Boolean(deleting_transaction)} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir transação</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir "{deleting_transaction?.description}"? Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending} className='gap-2'>
							{is_delete_pending && <Loader2 className='h-4 w-4 animate-spin' />}
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={Boolean(settling_transaction)} onOpenChange={(open) => !open && setSettlingTransaction(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Efetivar pagamento</DialogTitle>
					</DialogHeader>

					<div className='flex flex-col gap-1.5'>
						<label className='text-sm font-medium'>Pago em</label>
						<DateTimeField value={settle_date} disabled={is_settle_pending} onChange={setSettleDate} />
					</div>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => setSettlingTransaction(null)} disabled={is_settle_pending}>
							Cancelar
						</Button>
						<Button type='button' onClick={handleConfirmSettle} isLoading={is_settle_pending} className='gap-2'>
							Efetivar pagamento
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default TransactionList;
