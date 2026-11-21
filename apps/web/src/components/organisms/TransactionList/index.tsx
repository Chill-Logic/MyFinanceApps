import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, PROJECTED_HELP, RecurrenceUtils, TransactionUtils, type TTransaction, type TTransactionDirection, type TTransactionGroup } from '@myfinance/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
	ArrowDown,
	ArrowDownRight,
	ArrowLeftRight,
	ArrowRight,
	ArrowUp,
	ArrowUpDown,
	ArrowUpRight,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleDashed,
	Copy,
	CreditCard,
	Loader2,
	MoreVertical,
	Plus,
	Receipt,
	Repeat,
	User,
	Wallet,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteRecurrence } from '@/hooks/api/recurrences/useDeleteRecurrence';
import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import { useDeleteTransactions } from '@/hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useToast from '@/hooks/useToast';

import { useMonthSelection } from '@/context/monthSelection';
import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import DateTimeField from '@/components/molecules/DateTimeField';
import InvoiceReviewDialog from '@/components/organisms/InvoiceReviewDialog';
import MatchReviewDialog, { type TMatchReviewSource } from '@/components/organisms/MatchReviewDialog';
import TransactionDuplicateDialog from '@/components/organisms/TransactionDuplicateDialog';
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
		const date = new Date(TransactionUtils.groupingDate(transaction_item));
		const key = format(date, 'yyyy-MM-dd');

		if (!groups.has(key)) {
			groups.set(key, { label: groupLabel(date), items: [] });
		}
		groups.get(key)!.items.push(transaction_item);
	});

	/*
	 * Do dia mais recente pro mais antigo. O Map preserva ordem de INSERÇÃO, que é a ordem em que o
	 * backend mandou (`ORDER BY transaction_date DESC`) — mas o grupo é pela data de agrupamento, que em
	 * conta é o `settled_date` quando existe. As duas não têm relação, então sem este sort os cabeçalhos
	 * saíam na sequência das `transaction_date` (6, 8, 2, 5...). A chave é "YYYY-MM-DD" com zero à
	 * esquerda, então comparar string já ordena cronologicamente.
	 */
	return Array.from(groups.entries())
		.sort(([ a ], [ b ]) => b.localeCompare(a))
		.map(([ , group ]) => group);
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
const buildSummary = (group: TTransactionGroup | undefined, account_ids: ReadonlySet<string>) => {
	const non_draft = (group?.data || []).filter((item) => !item.draft);
	/* Transferência entre duas contas da carteira é interna: não é entrada nem saída (o backend também a zera). */
	const sumBy = (direction: TTransactionDirection) => non_draft
		.filter((item) => TransactionUtils.direction(item, account_ids) === direction)
		.reduce((acc, item) => acc + item.value, 0);

	const deposit = sumBy('in');
	const withdraw = sumBy('out');
	const settled = group?.total_settled ?? 0;
	const projected = group?.total_projected ?? 0;
	const pending_count = non_draft.filter((i) => !i.settled).length;

	return {
		deposit,
		withdraw,
		settled,
		projected,
		/* O que ainda falta acontecer no mês: diferença entre o previsto e o já efetivado (com sinal). */
		pending_net: projected - settled,
		pending_count,
	};
};

/* Saldo líquido (entradas - saídas) de uma seção, ignorando rascunhos — usado no subtotal do cartão. */
const sectionNet = (items: TTransaction[]) =>
	items
		.filter((item) => !item.draft)
		.reduce((acc, item) => acc + (item.kind === 'deposit' ? item.value : -item.value), 0);

/*
 * Ícone por sentido da transação pra visão atual (ver `TransactionUtils.direction`). Redesign: quadrado
 * neutro com a seta colorida (verde só pra entrada) — a saída não grita em vermelho em toda linha.
 */
const KIND_ICON_STYLE: Record<TTransactionDirection, { className: string; Icon: typeof ArrowUpRight }> = {
	in: { className: 'text-success', Icon: ArrowUpRight },
	out: { className: 'text-muted-foreground', Icon: ArrowDownRight },
	internal: { className: 'text-info', Icon: ArrowLeftRight },
};

const formatShortDate = (iso: string) => format(new Date(iso), 'd MMM', { locale: ptBR });

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
	const [ duplicating_transaction, setDuplicatingTransaction ] = useState<TTransaction | null>(null);
	const [ deleting_transaction, setDeletingTransaction ] = useState<TTransaction | null>(null);
	const [ reviewing_source, setReviewingSource ] = useState<{ id: string; name: string } | null>(null);
	const [ reviewing_match_source, setReviewingMatchSource ] = useState<TMatchReviewSource | null>(null);
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

	/*
	 * Excluir conta/carteira não apaga mais as transações: a origem pode ter sido excluída. Só dá pra
	 * afirmar isso quando a transação é DESTA carteira e a origem não está mais entre as ativas (uma origem
	 * de outra carteira, numa transferência recebida, não está nas listas daqui de qualquer jeito).
	 */
	const sources_loaded = Boolean(accounts_data && credit_balances_data);
	const isDeletedSource = (transaction_item: TTransaction) =>
		sources_loaded && transaction_item.wallet_id === wallet_id && !source_names.has(transaction_item.source_id);

	/* Contas que esta visão (a carteira) enxerga — decidem o sinal de uma transferência. */
	const account_ids = useMemo(() => new Set(accounts.map((account) => account.id)), [ accounts ]);

	/* Autor de cada transação só aparece quando a carteira é compartilhada — sozinho, é ruído em toda linha. */
	const { data: members_data } = useListWalletMembers({ wallet_id });
	const show_author = (members_data?.length ?? 0) > 1;

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

	const summary = buildSummary(data_all?.accounts, account_ids); // total do mês = SÓ contas (fluxo de caixa real)

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

	const { mutate: updateRecurrenceMutation, isPending: is_update_recurrence_pending } = useUpdateRecurrence();
	const { mutate: deleteRecurrenceMutation, isPending: is_delete_recurrence_pending } = useDeleteRecurrence();
	const is_deleting = is_delete_pending || is_update_recurrence_pending || is_delete_recurrence_pending;
	const deleting_is_recurring = Boolean(deleting_transaction && RecurrenceUtils.isRecurringOccurrence(deleting_transaction));

	/*
	 * Encerra a recorrência antes desta ocorrência ("esta e as próximas"): na 1ª ocorrência não há o que
	 * manter, então a recorrência inteira para de gerar; nas outras, o `end_date` vira a véspera dela.
	 */
	const endRecurrenceAt = (transaction_item: TTransaction) => {
		const onError = (error?: Error) => toast.error(getApiErrorMessage(error, 'Não foi possível encerrar a recorrência'));
		if (transaction_item.recurrence_index === 1) {
			deleteRecurrenceMutation({ id: transaction_item.recurrence_id!, onError });
			return;
		}

		updateRecurrenceMutation({
			id: transaction_item.recurrence_id!,
			body: { end_date: RecurrenceUtils.dayBefore(RecurrenceUtils.occurrenceDate(transaction_item)) },
			onError,
		});
	};

	const handleConfirmDelete = (scope: 'this' | 'following' = 'this') => {
		if (!deleting_transaction) return;

		const transaction_item = deleting_transaction;
		deleteTransactionMutation({
			id: transaction_item.id,
			onSuccess: () => {
				if (scope === 'following') endRecurrenceAt(transaction_item);
				toast.success(scope === 'following' ? 'Esta e as próximas excluídas' : 'Transação excluída com sucesso');
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

	const directionOf = (transaction_item: TTransaction) => TransactionUtils.direction(transaction_item, account_ids);

	const isPending = (transaction_item: TTransaction) => !transaction_item.draft && !transaction_item.settled;

	/* Quadrado neutro com a seta do sentido; bolinha âmbar no canto quando ainda está pendente. */
	const renderKindIcon = (transaction_item: TTransaction) => {
		const { className, Icon } = KIND_ICON_STYLE[directionOf(transaction_item)];

		return (
			<div className='relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent'>
				<Icon className={cn('h-[18px] w-[18px]', className)} />
				{isPending(transaction_item) && (
					<span aria-hidden='true' className='absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-warning-dot' />
				)}
			</div>
		);
	};

	/*
	 * Valor com sinal pela visão: + entrada (verde), − saída (cor do texto, sem vermelho), movimento interno
	 * (transferência) sem sinal. Pendente fica apagado: ainda não aconteceu.
	 */
	const renderValue = (transaction_item: TTransaction, className: string) => {
		const direction = directionOf(transaction_item);
		const sign = { in: '+', out: '−', internal: '' }[direction];
		const color = isPending(transaction_item)
			? 'text-muted-foreground'
			: { in: 'text-success', out: 'text-foreground', internal: 'text-muted-foreground' }[direction];

		return <span className={cn('whitespace-nowrap', className, color)}>{sign}{MoneyUtils.formatMoney(transaction_item.value)}</span>;
	};

	/* Ícone de repetição: só em recorrência comum — parcela já tem o "n/N" na descrição. */
	const renderRecurrenceIcon = (transaction_item: TTransaction) => (
		RecurrenceUtils.isRecurringOccurrence(transaction_item)
			? <Repeat className='h-3 w-3 shrink-0 text-muted-foreground' aria-label='Recorrente' />
			: null
	);

	/*
	 * Segunda linha da transação: origem (omitida dentro da seção de um cartão via `hide_source` — o
	 * cabeçalho já diz), selos de estado e, só em carteira compartilhada, quem lançou. Datas de previsão e
	 * pagamento ficam fora da lista (cabeçalho do dia + detalhe), pra linha caber em duas linhas.
	 */
	const renderMeta = (transaction_item: TTransaction, hide_source = false) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		/* `source_name` vem do backend e cobre origem de outra carteira (transferência recebida). */
		const source_label = transaction_item.source_name || source_names.get(transaction_item.source_id);
		const name = source_label && isDeletedSource(transaction_item) ? `${ source_label } (excluída)` : source_label;
		const is_transfer = transaction_item.kind === 'transfer';

		return (
			<div className='mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground'>
				{!hide_source && (
					<span className='inline-flex min-w-0 items-center gap-1 truncate'>
						{is_credit && <CreditCard className='h-3 w-3 shrink-0 text-info' />}
						<span className='truncate'>{name || (is_credit ? 'Crédito' : 'Conta')}</span>
						{/* Transferência: "De X para Y" */}
						{is_transfer && (
							<>
								<ArrowRight className='h-3 w-3 shrink-0' />
								<span className='truncate'>{transaction_item.destination_account_name || 'Conta'}</span>
							</>
						)}
					</span>
				)}

				{transaction_item.draft && <Badge variant='neutral'>Rascunho</Badge>}
				{isPending(transaction_item) && <Badge variant='warning' dot>Pendente</Badge>}
				{transaction_item.projected && (
					<Badge variant='outline' title={PROJECTED_HELP} className='cursor-help border-dashed'>Prevista</Badge>
				)}
				{is_credit && transaction_item.invoice_review === 'pending' && (
					<button
						type='button'
						onClick={(event) => {
							event.stopPropagation();
							setReviewingSource({ id: transaction_item.source_id, name: source_label || 'Crédito' });
						}}
						className='rounded-full transition-opacity hover:opacity-80'
					>
						<Badge variant='warning'>Fatura a confirmar</Badge>
					</button>
				)}
				{transaction_item.match_review === 'pending' && (
					<button
						type='button'
						onClick={(event) => {
							event.stopPropagation();
							setReviewingMatchSource({
								type: transaction_item.source_type,
								id: transaction_item.source_id,
								name: source_label || (is_credit ? 'Crédito' : 'Conta'),
							});
						}}
						className='rounded-full transition-opacity hover:opacity-80'
					>
						<Badge variant='info'>Conferir</Badge>
					</button>
				)}

				{show_author && (
					<span className='inline-flex items-center gap-1'>
						<User className='h-3 w-3' />
						{transaction_item.user_name}
					</span>
				)}
			</div>
		);
	};

	/*
	 * Destaque do mês: SÓ contas (fluxo de caixa real) — ver `buildSummary`. `settled` é o saldo efetivado
	 * acumulado até o fim do mês de referência; `projected`, onde ele termina contando o que ainda está
	 * pendente. Cartão marinho nos dois temas (é a peça de marca da tela).
	 */
	const renderHeroCard = () => (
		<div className='relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-navy-light from-0% to-navy to-60% p-5 text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none md:p-6'>
			<div aria-hidden='true' className='pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.32)_0%,rgba(163,188,116,0)_70%)]' />

			<span className='relative text-[13px] font-medium text-sand-light/70'>Saldo em contas</span>
			{is_loading ? (
				<Skeleton className='relative h-11 w-48 bg-sand-light/10' />
			) : (
				<span className={cn('relative text-[40px] font-semibold leading-none tracking-[-0.045em] md:text-[44px]', summary.settled < 0 && 'text-[#F5A99F]')}>
					{MoneyUtils.formatSignedMoney(summary.settled)}
				</span>
			)}

			<div className='relative flex flex-wrap gap-2'>
				<span className='inline-flex h-7 items-center gap-1.5 rounded-full bg-[rgba(163,188,116,0.18)] px-2.5 text-xs font-semibold text-[#C8DBA4]'>
					<ArrowUpRight className='h-3 w-3' />
					Fim do mês {is_loading ? '…' : MoneyUtils.formatSignedMoney(summary.projected)}
				</span>
				{summary.pending_count > 0 && (
					<span className='inline-flex h-7 items-center gap-1.5 rounded-full bg-sand-light/10 px-2.5 text-xs font-medium'>
						<span className='h-1.5 w-1.5 rounded-full bg-[#E9B949]' />
						{summary.pending_count} pendente{summary.pending_count > 1 ? 's' : ''}
					</span>
				)}
			</div>

			{/* Celular e tablet: entradas/saídas dentro do próprio cartão. No desktop viram cartões ao lado. */}
			<div className='relative mt-1 grid grid-cols-2 gap-3 border-t border-sand-light/15 pt-3 xl:hidden'>
				<span className='flex flex-col gap-0.5'>
					<span className='text-xs text-sand-light/70'>Entrou</span>
					<span className='text-base font-semibold text-[#9FE0B6]'>+ {MoneyUtils.formatMoney(summary.deposit)}</span>
				</span>
				<span className='flex flex-col gap-0.5'>
					<span className='text-xs text-sand-light/70'>Saiu</span>
					<span className='text-base font-semibold text-[#F5A99F]'>− {MoneyUtils.formatMoney(summary.withdraw)}</span>
				</span>
			</div>
		</div>
	);

	/* Desktop: Entrou / Saiu / Pendente em cartões ao lado do destaque. */
	const renderStatCard = (label: string, value: string, hint: string, tone: 'success' | 'neutral' | 'warning') => (
		<div
			className={cn(
				'flex flex-col justify-between gap-2 rounded-3xl p-5',
				tone === 'warning' ? 'bg-warning-soft' : 'border border-border bg-card',
			)}
		>
			<span className={cn('flex items-center gap-1.5 text-[13px] font-medium', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>
				{tone === 'warning' && <span className='h-1.5 w-1.5 rounded-full bg-warning-dot' />}
				{label}
			</span>
			{is_loading
				? <Skeleton className='h-7 w-28' />
				: <span className={cn('text-2xl font-semibold tracking-[-0.03em]', tone === 'success' && 'text-success')}>{value}</span>}
			<span className={cn('text-xs', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>{hint}</span>
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
				{/* Transferência não é editável — só duplicar, efetivar/desfazer e excluir. */}
				{transaction_item.kind !== 'transfer' && (
					<DropdownMenuItem onClick={() => setEditingTransaction(transaction_item)}>
						Editar
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onClick={() => setDuplicatingTransaction(transaction_item)}>
					<Copy className='mr-2 h-4 w-4' /> Duplicar
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className='text-destructive' onClick={() => setDeletingTransaction(transaction_item)}>
					Excluir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	/* ----- Desktop: linhas da tabela de contas ----- */
	const renderTableRow = (transaction_item: TTransaction) => (
		<TableRow key={transaction_item.id} className={cn('hover:bg-accent/50', transaction_item.draft && 'opacity-60')}>
			<TableCell className='py-3 pl-0 text-muted-foreground'>
				<div className='flex flex-col leading-tight'>
					<span className='capitalize'>{formatShortDate(transaction_item.transaction_date)}</span>
					{transaction_item.settled_date && (
						<span className='text-xs text-muted-foreground/80'>pago {format(new Date(transaction_item.settled_date), 'dd/MM HH:mm')}</span>
					)}
				</div>
			</TableCell>
			<TableCell className='py-3'>
				<div className='flex items-center gap-3'>
					{renderKindIcon(transaction_item)}
					<div className='flex min-w-0 flex-col'>
						<span className='flex items-center gap-1.5 font-semibold'>
							<span className='truncate'>{transaction_item.description}</span>
							{renderRecurrenceIcon(transaction_item)}
						</span>
						{renderMeta(transaction_item)}
					</div>
				</div>
			</TableCell>
			<TableCell className='py-3 text-right'>{renderValue(transaction_item, 'font-semibold')}</TableCell>
			<TableCell className='w-10 py-3 pr-0'>{renderActionsMenu(transaction_item)}</TableCell>
		</TableRow>
	);

	/*
	 * Seção de um cartão (desktop — coluna direita — e celular/tablet, abaixo das contas): cabeçalho no
	 * azul-petróleo do cartão + corpo animado (grid-rows) com rolagem interna (max-h).
	 */
	const renderCreditAccordion = (section: TCreditSection) => {
		const is_collapsed = !expanded.has(section.id);
		const net = sectionNet(section.items);

		return (
			<div key={section.id} className='overflow-hidden rounded-3xl border border-border bg-card'>
				<button
					type='button'
					onClick={() => toggleExpanded(section.id)}
					aria-expanded={!is_collapsed}
					className='flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/40'
				>
					<span className='flex min-w-0 items-center gap-3'>
						<span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal to-navy text-sand-light'>
							<CreditCard className='h-[18px] w-[18px]' />
						</span>
						<span className='flex min-w-0 flex-col'>
							<span className='truncate text-[15px] font-semibold'>{section.name}</span>
							<span className='text-xs text-muted-foreground'>
								{section.items.length} transaç{section.items.length === 1 ? 'ão' : 'ões'}
							</span>
						</span>
					</span>
					<span className='flex shrink-0 items-center gap-2'>
						<span className={cn('text-[15px] font-semibold', net >= 0 ? 'text-success' : 'text-foreground')}>
							{MoneyUtils.formatSignedMoney(net)}
						</span>
						<ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-300', is_collapsed && '-rotate-90')} />
					</span>
				</button>

				{/* Animação de altura via grid-rows (0fr↔1fr) — sem JS, funciona com o estado `collapsed` */}
				<div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', is_collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
					<div className='overflow-hidden'>
						<div className='max-h-96 overflow-y-auto border-t border-border px-4 pb-2'>{renderDayGroups(section.items, true)}</div>
					</div>
				</div>
			</div>
		);
	};

	/* ----- Celular/tablet: linha de transação em duas linhas ----- */
	const renderRow = (transaction_item: TTransaction, hide_source = false) => (
		<div
			key={transaction_item.id}
			className={cn('flex items-center gap-3 border-b border-border py-3 last:border-b-0', transaction_item.draft && 'opacity-60')}
		>
			{renderKindIcon(transaction_item)}

			<div className='flex min-w-0 flex-1 flex-col'>
				<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
					<span className='truncate'>{transaction_item.description}</span>
					{renderRecurrenceIcon(transaction_item)}
				</span>
				{renderMeta(transaction_item, hide_source)}
			</div>

			{renderValue(transaction_item, 'shrink-0 text-[15px] font-semibold')}

			<div className='-mr-2 shrink-0'>{renderActionsMenu(transaction_item)}</div>
		</div>
	);

	/* Total do dia no cabeçalho do grupo (mesma regra de sinal das linhas; rascunho fora). */
	const dayNet = (items: TTransaction[]) => items
		.filter((item) => !item.draft)
		.reduce((acc, item) => {
			const direction = directionOf(item);
			if (direction === 'in') return acc + item.value;
			if (direction === 'out') return acc - item.value;
			return acc;
		}, 0);

	const renderDayGroups = (items: TTransaction[], hide_source = false) =>
		groupTransactionsByDay(items).map((group) => {
			const net = dayNet(group.items);

			return (
				<section key={group.label} aria-label={group.label}>
					<div className='flex items-baseline justify-between pb-1 pt-4 text-xs font-semibold text-muted-foreground'>
						<span className='capitalize'>{group.label}</span>
						{net !== 0 && <span>{MoneyUtils.formatSignedMoney(net)}</span>}
					</div>
					{group.items.map((transaction_item) => renderRow(transaction_item, hide_source))}
				</section>
			);
		});

	const month_label = format(new Date(month_year.year, month_year.month, 1), 'MMMM yyyy', { locale: ptBR });

	return (
		<div className='flex h-full flex-col gap-4 md:gap-5'>
			{/* 1. Cabeçalho: carteira + mês (setas) + Nova transação (no celular o "+" da barra inferior cobre) */}
			<header className='flex items-center justify-between gap-3'>
				<div className='flex min-w-0 items-center gap-2'>
					<div className='flex min-w-0 flex-col'>
						{user_wallet.data?.name && <span className='truncate text-xs font-medium text-muted-foreground'>{user_wallet.data.name}</span>}
						<h1 className='truncate text-xl font-bold capitalize tracking-[-0.03em] md:text-2xl'>{month_label}</h1>
					</div>
					<div className='flex shrink-0 items-center gap-1'>
						<Button type='button' variant='outline' size='icon' className='h-9 w-9' onClick={() => changeMonth(-1)} aria-label='Mês anterior'>
							<ChevronLeft className='h-4 w-4' />
						</Button>
						<Button type='button' variant='outline' size='icon' className='h-9 w-9' onClick={() => changeMonth(1)} aria-label='Próximo mês'>
							<ChevronRight className='h-4 w-4' />
						</Button>
					</div>
				</div>

				<Button
					type='button'
					onClick={() => setIsNewTransactionOpen(true)}
					disabled={!wallet_id}
					className='hidden shrink-0 md:inline-flex'
				>
					<Plus className='h-4 w-4' strokeWidth={2.6} />
					Nova transação
				</Button>
			</header>

			{/* 2. Destaque do mês (só contas) + Entrou/Saiu/Pendente ao lado no desktop */}
			<section className='grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]'>
				{renderHeroCard()}
				<div className='hidden xl:contents'>
					{renderStatCard('Entrou', `+ ${ MoneyUtils.formatMoney(summary.deposit) }`, 'no mês, em contas', 'success')}
					{renderStatCard('Saiu', `− ${ MoneyUtils.formatMoney(summary.withdraw) }`, 'no mês, em contas', 'neutral')}
					{renderStatCard(
						'Pendente',
						MoneyUtils.formatSignedMoney(summary.pending_net),
						summary.pending_count > 0 ? `${ summary.pending_count } até o fim do mês` : 'nada pendente',
						'warning',
					)}
				</div>
			</section>

			{/* 3. Transações */}
			<div className='min-h-0 flex-1 overflow-y-auto'>
				{is_loading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className='h-16 w-full rounded-2xl' />
						))}
					</div>
				)}

				{/* Sem nenhuma origem → manda cadastrar em Contas & Cartões */}
				{!is_loading && !has_transactions && !has_sources && (
					<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
						<span className='flex h-14 w-14 items-center justify-center rounded-2xl bg-accent'>
							<Wallet className='h-6 w-6 text-muted-foreground' />
						</span>
						<div className='flex flex-col gap-1'>
							<span className='font-semibold'>Nenhuma conta ou cartão ainda</span>
							<span className='text-sm text-muted-foreground'>
								Crie uma conta ou um cartão em Contas &amp; Cartões para ver as transações aqui.
							</span>
						</div>
						<Button type='button' variant='secondary' onClick={() => navigate('/accounts')}>
							Ir para Contas &amp; Cartões
						</Button>
					</div>
				)}

				{!is_loading && !has_transactions && has_sources && (
					<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
						<span className='flex h-14 w-14 items-center justify-center rounded-2xl bg-accent'>
							<Receipt className='h-6 w-6 text-muted-foreground' />
						</span>
						<div className='flex flex-col gap-1'>
							<span className='font-semibold'>Nenhuma transação neste mês</span>
							<span className='text-sm text-muted-foreground'>Registre uma entrada, saída ou transferência pra começar</span>
						</div>
						<Button type='button' variant='secondary' onClick={() => setIsNewTransactionOpen(true)} disabled={!wallet_id}>
							<Plus className='h-4 w-4' />
							Adicionar transação
						</Button>
					</div>
				)}

				{!is_loading && has_transactions && (
					<div className='pb-2'>
						{/* Desktop (≥1280px): 2 colunas — Contas (tabela ordenável) | Cartões (seções por cartão) */}
						<div className='hidden gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_400px]'>
							<div className='flex flex-col gap-2'>
								<h2 className='px-1 text-[13px] font-semibold text-muted-foreground'>Contas</h2>
								{account_txs.length > 0 ? (
									<div className='rounded-3xl border border-border bg-card px-5 py-1'>
										<Table>
											<TableHeader>
												<TableRow className='hover:bg-transparent'>
													<TableHead className='w-24 pl-0'>
														<button type='button' onClick={() => toggleSort('transaction_date')} className='flex items-center gap-1 text-xs hover:text-foreground'>
															Data {renderSortIcon('transaction_date')}
														</button>
													</TableHead>
													<TableHead>
														<button type='button' onClick={() => toggleSort('description')} className='flex items-center gap-1 text-xs hover:text-foreground'>
															Descrição {renderSortIcon('description')}
														</button>
													</TableHead>
													<TableHead className='w-36 text-right'>
														<button type='button' onClick={() => toggleSort('value')} className='ml-auto flex items-center gap-1 text-xs hover:text-foreground'>
															Valor {renderSortIcon('value')}
														</button>
													</TableHead>
													<TableHead className='w-10 pr-0' />
												</TableRow>
											</TableHeader>
											<TableBody>
												{sortTransactions(account_txs, sort).map((transaction_item) => renderTableRow(transaction_item))}
											</TableBody>
										</Table>
									</div>
								) : (
									<p className='rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
										Nenhuma transação em contas neste mês
									</p>
								)}
							</div>

							<div className='flex flex-col gap-2'>
								<h2 className='px-1 text-[13px] font-semibold text-muted-foreground'>Cartões</h2>
								{credit_sections.length > 0 ? (
									<div className='flex flex-col gap-3'>{credit_sections.map(renderCreditAccordion)}</div>
								) : (
									<p className='rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground'>
										Nenhuma fatura neste mês
									</p>
								)}
							</div>
						</div>

						{/* Celular e tablet: contas agrupadas por dia num painel + seções de cartão abaixo */}
						<div className='flex flex-col gap-3 xl:hidden'>
							{account_txs.length > 0 && (
								<div className='rounded-3xl border border-border bg-card px-4 pb-1 md:px-5'>
									{renderDayGroups(account_txs)}
								</div>
							)}
							{credit_sections.map(renderCreditAccordion)}
						</div>
					</div>
				)}
			</div>

			<MatchReviewDialog
				open={Boolean(reviewing_match_source)}
				onOpenChange={(open) => !open && setReviewingMatchSource(null)}
				source={reviewing_match_source}
			/>
			<InvoiceReviewDialog
				open={Boolean(reviewing_source)}
				onOpenChange={(open) => !open && setReviewingSource(null)}
				creditBalance={reviewing_source}
			/>
			<TransactionFormDialog
				open={isFormOpen}
				onOpenChange={handleFormOpenChange}
				transaction={editing_transaction}
				suggestedDate={new Date(month_year.year, month_year.month, new Date().getDate())}
			/>

			<TransactionDuplicateDialog
				open={Boolean(duplicating_transaction)}
				onOpenChange={(open) => !open && setDuplicatingTransaction(null)}
				transaction={duplicating_transaction}
				sourceName={duplicating_transaction ? (duplicating_transaction.source_name || source_names.get(duplicating_transaction.source_id)) : undefined}
			/>

			<AlertDialog open={Boolean(deleting_transaction)} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir transação</AlertDialogTitle>
						<AlertDialogDescription>
							{deleting_is_recurring
								? `"${ deleting_transaction?.description }" é uma recorrência. Excluir só esta ou esta e as próximas?`
								: `Deseja excluir "${ deleting_transaction?.description }"? Essa ação não pode ser desfeita.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_deleting}>Cancelar</AlertDialogCancel>
						{deleting_is_recurring && (
							<AlertDialogAction onClick={() => handleConfirmDelete('following')} disabled={is_deleting} className='gap-2'>
								{is_deleting && <Loader2 className='h-4 w-4 animate-spin' />}
								Esta e as próximas
							</AlertDialogAction>
						)}
						<AlertDialogAction onClick={() => handleConfirmDelete('this')} disabled={is_deleting} className='gap-2'>
							{is_deleting && <Loader2 className='h-4 w-4 animate-spin' />}
							{deleting_is_recurring ? 'Só esta' : 'Excluir'}
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
