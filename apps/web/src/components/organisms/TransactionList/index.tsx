import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, InvoiceUtils, MoneyUtils, PROJECTED_HELP, RecurrenceUtils, TransactionUtils, type TTransaction, type TTransactionDirection, type TTransactionGroup } from '@myfinance/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	ArrowUpDown,
	ArrowUpRight,
	Check,
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
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useToast from '@/hooks/useToast';

import { useMonthSelection } from '@/context/monthSelection';
import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import Logo from '@/components/atoms/Logo';
import DateTimeField from '@/components/molecules/DateTimeField';
import SegmentedControl from '@/components/molecules/SegmentedControl';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TSortField = 'transaction_date' | 'description' | 'kind' | 'value';
type TSortState = { field: TSortField; direction: 'asc' | 'desc' };
type TListTab = 'accounts' | 'credits';

/* "Dom, 30 nov" — dia da semana abreviado + dia + mês abreviado, como no mockup do redesign. */
const groupLabel = (date: Date) => {
	const label = format(date, 'EEE, d MMM', { locale: ptBR }).replace(/\./g, '');
	return label.charAt(0).toUpperCase() + label.slice(1);
};

/* Iniciais da descrição para o quadrado da linha ("IRPF 7ª quota" → "I7", "Montador" → "MO"). */
const initialsOf = (text: string) => {
	const words = text.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return '?';
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return (words[0][0] + words[1][0]).toUpperCase();
};

/* Separa "R$ 2.531,94" em "R$ 2.531" + ",94" para os centavos aparecerem apagados no destaque. */
const splitCents = (formatted: string) => {
	const comma = formatted.lastIndexOf(',');
	return comma === -1 ? [ formatted, '' ] : [ formatted.slice(0, comma), formatted.slice(comma) ];
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
	const countBy = (direction: TTransactionDirection) => non_draft
		.filter((item) => TransactionUtils.direction(item, account_ids) === direction).length;
	const settled = group?.total_settled ?? 0;
	const projected = group?.total_projected ?? 0;
	const pending_count = non_draft.filter((i) => !i.settled).length;

	return {
		deposit,
		withdraw,
		deposit_count: countBy('in'),
		withdraw_count: countBy('out'),
		settled,
		projected,
		/* O que ainda falta acontecer no mês: diferença entre o previsto e o já efetivado (com sinal). */
		pending_net: projected - settled,
		pending_count,
	};
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
	const { user_wallet, setUserWallet, is_loading: is_wallet_loading } = useWallet();
	const { data: wallets_data } = useIndexWallets();
	const [ is_wallet_menu_open, setIsWalletMenuOpen ] = useState(false);
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
	/* Aba da lista: contas (fluxo de caixa) ou cartões (compras das faturas do mês). */
	const [ list_tab, setListTab ] = useState<TListTab>('accounts');

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
	 * O backend já separa em `accounts` (bucket mês-calendário) e `credits` (bucket ciclo da fatura). A
	 * lista mostra um por vez, pelas abas Contas | Cartões.
	 */
	const account_txs = useMemo(() => data_all?.accounts.data || [], [ data_all ]);
	const credit_txs = useMemo(() => data_all?.credits.data || [], [ data_all ]);
	const tab_txs = list_tab === 'accounts' ? account_txs : credit_txs;

	const now = new Date();
	const is_current_month = month_year.year === now.getFullYear() && month_year.month === now.getMonth();

	/* Cartão em destaque (tablet/desktop): o de fatura mais alta ainda em aberto; sem nenhuma em aberto, o primeiro. */
	const featured_credit = useMemo(() => {
		const open = credit_balances.filter((credit_balance) => (credit_balance.current_invoice?.remaining ?? 0) > 0);
		const pool = open.length ? open : credit_balances;
		return [ ...pool ].sort((a, b) => (b.current_invoice?.remaining ?? 0) - (a.current_invoice?.remaining ?? 0))[0];
	}, [ credit_balances ]);

	/*
	 * Próximos 7 dias: pendentes de conta com data entre hoje e daqui a 7 dias. Só no mês atual, e só enxerga
	 * o que veio na busca do mês — perto da virada, o que cai no mês seguinte ainda não aparece.
	 */
	const upcoming = useMemo(() => {
		if (!is_current_month) return [];
		const today = new Date();
		const start_time = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		const limit_time = start_time + 8 * 24 * 60 * 60 * 1000;
		return account_txs
			.filter((item) => !item.draft && !item.settled)
			.filter((item) => {
				const time = new Date(item.transaction_date).getTime();
				return time >= start_time && time < limit_time;
			})
			.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
			.slice(0, 4);
	}, [ account_txs, is_current_month ]);

	const summary = buildSummary(data_all?.accounts, account_ids); // total do mês = SÓ contas (fluxo de caixa real)

	const has_transactions = account_txs.length + credit_txs.length > 0;
	const has_sources = accounts.length > 0 || credit_balances.length > 0;

	const changeMonth = (offset: number) => {
		const date = new Date(month_year.year, month_year.month + offset, 1);
		setMonthYear({ month: date.getMonth(), year: date.getFullYear() });
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

	/* Quadrado com as iniciais da descrição; bolinha âmbar no canto quando ainda está pendente. */
	const renderKindIcon = (transaction_item: TTransaction) => (
		<div className='relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-accent text-[13px] font-bold text-foreground'>
			{initialsOf(transaction_item.description)}
			{isPending(transaction_item) && (
				<span aria-hidden='true' className='absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-warning-dot' />
			)}
		</div>
	);

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
	 * pendente. Cartão marinho nos dois temas (é a peça de marca da tela). Layout por tamanho:
	 *   - celular: saldo + chips, Entrou/Saiu numa linha embaixo;
	 *   - tablet: saldo + chips à esquerda, Entrou/Saiu/Pendente em lista à direita;
	 *   - desktop: só saldo + chips (Entrou/Saiu/Pendente viram cartões ao lado — `renderStatCard`).
	 */
	const is_past_month = new Date(month_year.year, month_year.month + 1, 1) <= new Date(now.getFullYear(), now.getMonth(), 1);
	const heroLabel = () => {
		if (is_current_month) return 'Saldo hoje';
		if (is_past_month) return 'Saldo no fim do mês';
		return 'Saldo efetivado';
	};
	const hero_label = heroLabel();
	const [ settled_main, settled_cents ] = splitCents(MoneyUtils.formatSignedMoney(summary.settled));

	const renderHeroCard = () => (
		<div className='relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-navy-light from-0% to-navy to-60% p-5 text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none md:p-6'>
			<div aria-hidden='true' className='pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.34)_0%,rgba(163,188,116,0)_70%)]' />

			<div className='relative grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-cols-1'>
				<div className='flex flex-col gap-3'>
					<span className='text-[13px] font-medium text-[#A9B6BF]'>{hero_label}</span>
					{is_loading ? (
						<Skeleton className='h-11 w-52 bg-sand-light/10' />
					) : (
						<span className='text-[44px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[46px]'>
							{settled_main}<span className='text-[#7F919C]'>{settled_cents}</span>
						</span>
					)}
					<div className='flex flex-wrap gap-2'>
						<span className='inline-flex h-7 items-center gap-1.5 rounded-full bg-[rgba(163,188,116,0.18)] px-2.5 text-xs font-semibold text-[#C8DBA4]'>
							<ArrowUpRight className='h-3 w-3' strokeWidth={2.4} />
							Fim do mês {is_loading ? '…' : MoneyUtils.formatSignedMoney(summary.projected)}
						</span>
						{summary.pending_count > 0 && (
							<span className='inline-flex h-7 items-center gap-1.5 rounded-full bg-sand-light/10 px-2.5 text-xs font-medium text-[#E2DFDB]'>
								<span className='h-1.5 w-1.5 rounded-full bg-[#E9B949]' />
								{summary.pending_count} pendente{summary.pending_count > 1 ? 's' : ''} · {MoneyUtils.formatMoney(Math.abs(summary.pending_net))}
							</span>
						)}
					</div>
				</div>

				{/* Tablet: Entrou/Saiu/Pendente em lista à direita do saldo */}
				<div className='hidden flex-col justify-center gap-3.5 border-l border-sand-light/15 pl-5 text-sm md:flex xl:hidden'>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>Entrou</span><span className='font-semibold text-[#9FE0B6]'>+ {MoneyUtils.formatMoney(summary.deposit)}</span></span>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>Saiu</span><span className='font-semibold text-[#F5A99F]'>− {MoneyUtils.formatMoney(summary.withdraw)}</span></span>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>Pendente</span><span className='font-semibold text-[#F2D58A]'>{MoneyUtils.formatSignedMoney(summary.pending_net)}</span></span>
				</div>
			</div>

			{/* Celular: Entrou/Saiu numa linha embaixo */}
			<div className='relative mt-4 grid grid-cols-2 gap-3 border-t border-sand-light/15 pt-3 md:hidden'>
				<span className='flex flex-col gap-0.5'>
					<span className='text-xs text-[#A9B6BF]'>Entrou</span>
					<span className='text-[17px] font-semibold text-[#9FE0B6]'>+ {MoneyUtils.formatMoney(summary.deposit)}</span>
				</span>
				<span className='flex flex-col gap-0.5'>
					<span className='text-xs text-[#A9B6BF]'>Saiu</span>
					<span className='text-[17px] font-semibold text-[#F5A99F]'>− {MoneyUtils.formatMoney(summary.withdraw)}</span>
				</span>
			</div>
		</div>
	);

	/* Desktop: Entrou / Saiu / Pendente em cartões ao lado do destaque. */
	const renderStatCard = (label: string, value: string, hint: string, tone: 'success' | 'neutral' | 'warning') => (
		<div
			className={cn(
				'flex flex-col justify-between gap-2 rounded-3xl p-5',
				tone === 'warning' ? 'bg-warning-soft' : 'border border-border bg-card shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:shadow-none',
			)}
		>
			<span className={cn('flex items-center gap-1.5 text-[13px] font-medium', tone === 'warning' ? 'font-semibold text-warning' : 'text-muted-foreground')}>
				{tone === 'warning' && <span className='h-[7px] w-[7px] rounded-full bg-warning-dot' />}
				{label}
			</span>
			{is_loading
				? <Skeleton className='h-7 w-28' />
				: <span className={cn('text-2xl font-semibold tracking-[-0.03em]', tone === 'success' && 'text-success')}>{value}</span>}
			<span className={cn('text-xs', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>{hint}</span>
		</div>
	);

	const plural = (count: number, singular: string, plural_word: string) => `${ count } ${ count === 1 ? singular : plural_word }`;

	/*
	 * Cartão da fatura (tablet e desktop): o crédito com a maior fatura em aberto, no degradê azul-petróleo
	 * do logo. Leva para Contas & Cartões.
	 */
	const renderInvoiceCard = () => {
		if (!featured_credit) return null;

		const invoice = featured_credit.current_invoice;
		const used_ratio = featured_credit.credit_limit > 0
			? Math.min(1, Math.max(0, featured_credit.used / featured_credit.credit_limit))
			: 0;

		return (
			<button
				type='button'
				onClick={() => navigate('/accounts')}
				className='flex flex-col gap-2 rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#12708A_0%,#0B3E52_50%,#082435_100%)] p-5 text-left text-sand-light transition-transform hover:-translate-y-0.5'
			>
				<span className='flex justify-between gap-3 text-[13px]'>
					<span className='truncate font-semibold'>{featured_credit.name}</span>
					{invoice?.due_date && <span className='shrink-0 text-[#A9B6BF]'>vence {formatShortDate(invoice.due_date)}</span>}
				</span>
				{invoice && <span className='text-xs text-[#A9B6BF]'>Fatura de {InvoiceUtils.label(invoice)}</span>}
				<span className='text-[28px] font-semibold tracking-[-0.04em]'>{MoneyUtils.formatMoney(invoice?.amount ?? 0)}</span>
				<span aria-hidden='true' className='flex h-1.5 overflow-hidden rounded-full bg-sand-light/15'>
					<span className='rounded-full bg-[#A3BC74]' style={{ width: `${ Math.round(used_ratio * 100) }%` }} />
				</span>
				<span className='text-xs text-[#A9B6BF]'>
					{invoice && invoice.paid_amount > 0 && invoice.remaining > 0
						? `restante ${ MoneyUtils.formatMoney(invoice.remaining) } · `
						: ''}
					{MoneyUtils.formatMoney(featured_credit.available)} de limite disponível
				</span>
			</button>
		);
	};

	/* Próximos 7 dias (tablet e desktop, só no mês atual): o que ainda vai sair/entrar das contas. */
	const renderUpcoming = () => {
		if (!is_current_month) return null;

		return (
			<div className='flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:shadow-none'>
				<span className='text-sm font-bold'>Próximos 7 dias</span>
				{upcoming.length === 0 ? (
					<span className='text-sm text-muted-foreground'>Nada pendente nos próximos dias.</span>
				) : upcoming.map((item) => (
					<span key={item.id} className='flex items-center justify-between gap-3 text-sm'>
						<span className='truncate'>{item.description}</span>
						<span className='shrink-0 text-muted-foreground'>{formatShortDate(item.transaction_date)}</span>
					</span>
				))}
			</div>
		);
	};

	/* Celular: pílula da carteira (ícone do logo + nome) que abre a lista de carteiras. */
	const renderWalletPill = () => (
		<Popover open={is_wallet_menu_open} onOpenChange={setIsWalletMenuOpen}>
			<PopoverTrigger asChild>
				<button
					type='button'
					className='flex h-10 min-w-0 items-center gap-2.5 rounded-full border border-border bg-card pl-1 pr-3.5 text-sm font-semibold'
				>
					<Logo variant='icon' size={24} />
					<span className='truncate'>{user_wallet.data?.name || 'Carteira'}</span>
					<ChevronDown className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
				</button>
			</PopoverTrigger>
			<PopoverContent align='start' className='w-64 p-1.5'>
				{(wallets_data?.data || []).map((wallet) => (
					<button
						key={wallet.id}
						type='button'
						onClick={() => {
							setUserWallet({ data: wallet });
							setIsWalletMenuOpen(false);
						}}
						className='flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent'
					>
						<span className='truncate'>{wallet.name}</span>
						{wallet.id === wallet_id && <Check className='h-4 w-4 shrink-0 text-brand' />}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);

	const short_month_label = format(new Date(month_year.year, month_year.month, 1), 'MMM yyyy', { locale: ptBR }).replace('.', '');

	/* Celular: pílula do mês com as setas. */
	const renderMonthPill = () => (
		<div className='flex h-10 shrink-0 items-center rounded-full border border-border bg-card'>
			<button type='button' onClick={() => changeMonth(-1)} aria-label='Mês anterior' className='flex h-10 w-9 items-center justify-center text-muted-foreground'>
				<ChevronLeft className='h-3.5 w-3.5' />
			</button>
			<span className='text-[13px] font-semibold capitalize'>{short_month_label}</span>
			<button type='button' onClick={() => changeMonth(1)} aria-label='Próximo mês' className='flex h-10 w-9 items-center justify-center text-muted-foreground'>
				<ChevronRight className='h-3.5 w-3.5' />
			</button>
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

	/* ----- Desktop: linhas da tabela (Data | Descrição | Conta | Valor) ----- */
	const renderTableRow = (transaction_item: TTransaction) => {
		const source_label = transaction_item.source_name || source_names.get(transaction_item.source_id) || '';
		const deleted_suffix = isDeletedSource(transaction_item) ? ' (excluída)' : '';
		const source_text = transaction_item.kind === 'transfer'
			? `${ source_label } → ${ transaction_item.destination_account_name || 'Conta' }`
			: `${ source_label }${ deleted_suffix }`;

		return (
			<TableRow key={transaction_item.id} className={cn('hover:bg-accent/40', transaction_item.draft && 'opacity-60')}>
				<TableCell className='py-3.5 pl-0 align-top capitalize text-muted-foreground'>{formatShortDate(transaction_item.transaction_date)}</TableCell>
				<TableCell className='py-3.5 align-top'>
					<div className='flex min-w-0 flex-col'>
						<span className='flex min-w-0 items-center gap-1.5 font-semibold'>
							<span className='truncate'>{transaction_item.description}</span>
							{renderRecurrenceIcon(transaction_item)}
						</span>
						{renderMeta(transaction_item, true)}
					</div>
				</TableCell>
				<TableCell className='py-3.5 align-top text-muted-foreground'><span className='line-clamp-2'>{source_text}</span></TableCell>
				<TableCell className='py-3.5 text-right align-top'>{renderValue(transaction_item, 'font-semibold')}</TableCell>
				<TableCell className='w-10 py-2.5 pr-0 align-top'>{renderActionsMenu(transaction_item)}</TableCell>
			</TableRow>
		);
	};

	/* ----- Celular/tablet: transação em duas linhas ----- */
	const renderRow = (transaction_item: TTransaction) => (
		<div
			key={transaction_item.id}
			className={cn('flex items-center gap-3 py-2.5', transaction_item.draft && 'opacity-60')}
		>
			{renderKindIcon(transaction_item)}

			<div className='flex min-w-0 flex-1 flex-col'>
				<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
					<span className='truncate'>{transaction_item.description}</span>
					{renderRecurrenceIcon(transaction_item)}
				</span>
				{renderMeta(transaction_item)}
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

	const renderDayGroups = (items: TTransaction[]) =>
		groupTransactionsByDay(items).map((group) => {
			const net = dayNet(group.items);

			return (
				<section key={group.label} aria-label={group.label}>
					<div className='flex items-baseline justify-between pb-1.5 pt-4 text-xs font-semibold text-muted-foreground'>
						<span>{group.label}</span>
						{net !== 0 && <span>{MoneyUtils.formatSignedMoney(net)}</span>}
					</div>
					{group.items.map((transaction_item) => renderRow(transaction_item))}
				</section>
			);
		});

	const renderTabs = () => (
		<SegmentedControl
			className='w-[200px] shrink-0'
			segments={[ { value: 'accounts', label: 'Contas' }, { value: 'credits', label: 'Cartões' } ]}
			value={list_tab}
			onChange={(value) => setListTab(value as TListTab)}
		/>
	);

	const tab_empty_text = list_tab === 'accounts' ? 'Nenhuma transação em contas neste mês' : 'Nenhuma compra no cartão neste mês';

	const month_label = format(new Date(month_year.year, month_year.month, 1), 'MMMM yyyy', { locale: ptBR });
	const show_side_cards = Boolean(featured_credit) || is_current_month;

	return (
		<div className='flex h-full flex-col gap-4 md:gap-5'>
			{/* 1a. Celular: pílula da carteira + pílula do mês */}
			<div className='flex items-center justify-between gap-2 md:hidden'>
				{renderWalletPill()}
				{renderMonthPill()}
			</div>

			{/* 1b. Tablet e desktop: carteira (só no tablet — no desktop está na barra lateral) + mês + Nova transação */}
			<header className='hidden items-center justify-between gap-3 md:flex'>
				<div className='flex min-w-0 flex-col gap-0.5'>
					{user_wallet.data?.name && <span className='truncate text-[13px] font-medium text-muted-foreground xl:hidden'>{user_wallet.data.name}</span>}
					<div className='flex items-center gap-2.5'>
						<h1 className='text-2xl font-bold capitalize tracking-[-0.03em] xl:text-[26px]'>{month_label}</h1>
						<Button type='button' variant='outline' size='icon' className='h-[34px] w-[34px] bg-card text-muted-foreground' onClick={() => changeMonth(-1)} aria-label='Mês anterior'>
							<ChevronLeft className='h-3.5 w-3.5' />
						</Button>
						<Button type='button' variant='outline' size='icon' className='h-[34px] w-[34px] bg-card text-muted-foreground' onClick={() => changeMonth(1)} aria-label='Próximo mês'>
							<ChevronRight className='h-3.5 w-3.5' />
						</Button>
					</div>
				</div>

				<Button type='button' onClick={() => setIsNewTransactionOpen(true)} disabled={!wallet_id} className='h-11 shrink-0 px-5'>
					<Plus className='h-4 w-4' strokeWidth={2.6} />
					Nova transação
				</Button>
			</header>

			{/* 2. Destaque do mês (só contas) + Entrou/Saiu/Pendente ao lado no desktop */}
			<section className='grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]'>
				{renderHeroCard()}
				<div className='hidden xl:contents'>
					{renderStatCard('Entrou', `+ ${ MoneyUtils.formatMoney(summary.deposit) }`, plural(summary.deposit_count, 'lançamento', 'lançamentos'), 'success')}
					{renderStatCard('Saiu', `− ${ MoneyUtils.formatMoney(summary.withdraw) }`, plural(summary.withdraw_count, 'lançamento', 'lançamentos'), 'neutral')}
					{renderStatCard(
						'Pendente',
						MoneyUtils.formatSignedMoney(summary.pending_net),
						summary.pending_count > 0 ? `${ summary.pending_count } até o fim do mês` : 'nada pendente',
						'warning',
					)}
				</div>
			</section>

			{/* 3. Tablet: fatura + próximos 7 dias lado a lado */}
			{show_side_cards && (
				<section className='hidden gap-4 md:grid md:grid-cols-2 xl:hidden'>
					{renderInvoiceCard()}
					{renderUpcoming()}
				</section>
			)}

			{/* 4. Transações */}
			<div className='min-h-0 flex-1 overflow-y-auto'>
				{is_loading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className='h-16 w-full rounded-2xl' />
						))}
					</div>
				)}

				{/* Sem nenhuma origem → manda cadastrar em Contas & Cartões */}
				{!is_loading && !has_sources && (
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

				{!is_loading && has_sources && (
					<div className='grid gap-4 pb-2 xl:grid-cols-[minmax(0,1fr)_360px]'>
						<div className='flex flex-col md:rounded-3xl md:border md:border-border md:bg-card md:px-5 md:pb-2 md:pt-4 md:shadow-[0_1px_2px_rgba(8,36,53,0.05)] md:dark:shadow-none xl:px-6'>
							<div className='flex items-center justify-between gap-3'>
								{renderTabs()}
								<span className='text-xs text-muted-foreground'>{plural(tab_txs.length, 'transação', 'transações')}</span>
							</div>

							{!has_transactions && (
								<div className='flex flex-col items-center gap-3 px-6 py-12 text-center'>
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

							{has_transactions && tab_txs.length === 0 && (
								<p className='py-10 text-center text-sm text-muted-foreground'>{tab_empty_text}</p>
							)}

							{has_transactions && tab_txs.length > 0 && (
								<>
									{/* Celular e tablet: agrupado por dia */}
									<div className='xl:hidden'>{renderDayGroups(tab_txs)}</div>

									{/* Desktop: tabela ordenável */}
									<div className='hidden pt-2 xl:block'>
										<Table>
											<TableHeader>
												<TableRow className='hover:bg-transparent'>
													<TableHead className='w-24 pl-0'>
														<button type='button' onClick={() => toggleSort('transaction_date')} className='flex items-center gap-1 text-xs font-semibold hover:text-foreground'>
															Data {renderSortIcon('transaction_date')}
														</button>
													</TableHead>
													<TableHead>
														<button type='button' onClick={() => toggleSort('description')} className='flex items-center gap-1 text-xs font-semibold hover:text-foreground'>
															Descrição {renderSortIcon('description')}
														</button>
													</TableHead>
													<TableHead className='w-44 text-xs font-semibold'>{list_tab === 'accounts' ? 'Conta' : 'Cartão'}</TableHead>
													<TableHead className='w-32 text-right'>
														<button type='button' onClick={() => toggleSort('value')} className='ml-auto flex items-center gap-1 text-xs font-semibold hover:text-foreground'>
															Valor {renderSortIcon('value')}
														</button>
													</TableHead>
													<TableHead className='w-10 pr-0' />
												</TableRow>
											</TableHeader>
											<TableBody>
												{sortTransactions(tab_txs, sort).map((transaction_item) => renderTableRow(transaction_item))}
											</TableBody>
										</Table>
									</div>
								</>
							)}
						</div>

						{/* Desktop: fatura + próximos 7 dias na coluna da direita */}
						{show_side_cards && (
							<div className='hidden flex-col gap-4 xl:flex'>
								{renderInvoiceCard()}
								{renderUpcoming()}
							</div>
						)}
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
