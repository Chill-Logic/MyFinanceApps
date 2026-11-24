import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, PROJECTED_HELP, RecurrenceUtils, TransactionUtils, type TCurrentInvoice, type TTransaction, type TTransactionDirection, type TTransactionGroup } from '@myfinance/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
	ArrowDownRight,
	ArrowRight,
	ArrowUpRight,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleDashed,
	Copy,
	Info,
	CreditCard,
	Loader2,
	Minus,
	MoreVertical,
	Pencil,
	Plus,
	Receipt,
	Repeat,
	RotateCcw,
	Trash2,
	User,
	Wallet,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useGetInvoicesForMonth } from '@/hooks/api/credit-balances/useGetInvoicesForMonth';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteRecurrence } from '@/hooks/api/recurrences/useDeleteRecurrence';
import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import { useDeleteTransactions } from '@/hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useMediaQuery from '@/hooks/useMediaQuery';
import useMonthTransition from '@/hooks/useMonthTransition';
import useToast from '@/hooks/useToast';

import { useMonthSelection } from '@/context/monthSelection';
import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { groupTransactionsByDay } from '@/util/groupTransactionsByDay';

import Button from '@/components/atoms/Button';
import Logo from '@/components/atoms/Logo';
import DateTimeField from '@/components/molecules/DateTimeField';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import InvoiceReviewDialog from '@/components/organisms/InvoiceReviewDialog';
import MatchReviewDialog, { type TMatchReviewSource } from '@/components/organisms/MatchReviewDialog';
import TransactionDetailSheet from '@/components/organisms/TransactionDetailSheet';
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

type TListTab = 'accounts' | 'credits';
type TCreditSection = { id: string; name: string; items: TTransaction[] };

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
	/*
	 * Entrou/Saiu = só o que JÁ ACONTECEU (efetivado). O que ainda não foi pago fica só no Pendente — antes
	 * os dois somavam o pendente e a mesma saída aparecia em "Saiu" e em "Pendente" ao mesmo tempo.
	 * Transferência entre duas contas da carteira é interna: não é entrada nem saída (o backend também a zera).
	 */
	const settled_items = non_draft.filter((item) => item.settled);
	const byDirection = (direction: TTransactionDirection) => settled_items
		.filter((item) => TransactionUtils.direction(item, account_ids) === direction);
	const sumBy = (direction: TTransactionDirection) => byDirection(direction).reduce((acc, item) => acc + item.value, 0);

	const deposit = sumBy('in');
	const withdraw = sumBy('out');
	const countBy = (direction: TTransactionDirection) => byDirection(direction).length;
	const settled = group?.total_settled ?? 0;
	const projected = group?.total_projected ?? 0;
	const pending = non_draft.filter((item) => !item.settled);
	/*
	 * Pendente separado em "a receber" e "a pagar": um não anula o outro (um Pix a receber não diminui a
	 * conta a pagar). Transferência interna fica de fora.
	 */
	const pendingBy = (direction: TTransactionDirection) => pending.filter((item) => TransactionUtils.direction(item, account_ids) === direction);
	const pending_in_items = pendingBy('in');
	const pending_out_items = pendingBy('out');
	const pending_in = pending_in_items.reduce((acc, item) => acc + item.value, 0);
	const pending_out = pending_out_items.reduce((acc, item) => acc + item.value, 0);

	return {
		deposit,
		withdraw,
		deposit_count: countBy('in'),
		withdraw_count: countBy('out'),
		settled,
		projected,
		pending_in,
		pending_out,
		pending_in_count: pending_in_items.length,
		pending_out_count: pending_out_items.length,
		pending_count: pending_in_items.length + pending_out_items.length,
	};
};

/* Separa "R$ 2.531,94" em "R$ 2.531" + ",94" para os centavos aparecerem apagados no destaque. */
const splitCents = (formatted: string) => {
	const comma = formatted.lastIndexOf(',');
	return comma === -1 ? [ formatted, '' ] : [ formatted.slice(0, comma), formatted.slice(comma) ];
};

/* Valor sem o "R$": listas e cartões de resumo mostram só o número, como no mockup. */
const plainMoney = (value: number) => MoneyUtils.formatMoney(Math.abs(value)).replace(/^R\$\s?/, '');

/* "+ 1.612,00" / "− 390,00" com o menos tipográfico (zero sai sem sinal); `symbol` mantém o "R$". */
const signedMoney = (value: number, symbol = false) => {
	const body = symbol ? MoneyUtils.formatMoney(Math.abs(value)) : plainMoney(value);
	if (value === 0) return body;
	return `${ value < 0 ? '−' : '+' } ${ body }`;
};

/* Superfície dos cartões claros/translúcidos do mockup (branco no claro, véu areia no escuro). */
const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';

/* Chip "Fim do mês" do destaque (fundo marinho fixo): positivo oliva ↗, negativo salmão ↘, zero neutro. */
const PROJECTED_TONE: Record<-1 | 0 | 1, { className: string; Icon: typeof ArrowUpRight }> = {
	1: { className: 'bg-[rgba(163,188,116,0.18)] text-[#C8DBA4]', Icon: ArrowUpRight },
	0: { className: 'bg-sand-light/10 text-[#E2DFDB]', Icon: Minus },
	[-1]: { className: 'bg-[rgba(245,169,159,0.18)] text-[#F5A99F]', Icon: ArrowDownRight },
};

const formatShortDate = (iso: string) => format(new Date(iso), 'd MMM', { locale: ptBR });

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
	/* Detalhe aberto: guarda o id e lê a transação da lista atual (assim reflete efetivar/desfazer na hora). */
	const [ detail_id, setDetailId ] = useState<string | null>(null);
	const [ settle_date, setSettleDate ] = useState<Date>(new Date());
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

	/*
	 * Aba Cartões: uma seção por cartão, na ordem das linhas de crédito (o que sobrar, origem não listada,
	 * vai no fim). O total da seção é o líquido das compras do mês no cartão (estorno abate).
	 */
	const credit_sections = useMemo<TCreditSection[]>(() => {
		const map = new Map<string, TTransaction[]>();
		credit_txs.forEach((transaction_item) => {
			const list = map.get(transaction_item.source_id) || [];
			list.push(transaction_item);
			map.set(transaction_item.source_id, list);
		});

		const ordered: TCreditSection[] = [];
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

	/* Fatura do mês exibido de cada cartão da carteira (o total que importa — ver o hook). */
	const { invoices } = useGetInvoicesForMonth({
		ids: credit_balances.map((credit_balance) => credit_balance.id),
		reference,
		enabled: credit_balances.length > 0,
	});

	/* Cartões que aparecem em "Faturas do mês": com fatura no mês OU com alguma transação nele. */
	const invoice_cards = credit_balances
		.map((credit_balance) => ({ id: credit_balance.id, name: credit_balance.name, invoice: invoices.get(credit_balance.id) }))
		.filter((card) => (card.invoice?.amount ?? 0) > 0 || credit_sections.some((section) => section.id === card.id));

	/* O que falta pagar das faturas do mês (mesma soma do card "Faturas do mês"). */
	const invoices_open = invoice_cards.reduce((acc, card) => acc + (card.invoice?.remaining ?? 0), 0);

	/* Cartões abertos na aba Cartões (fora do Set = fechado, que é o padrão). */
	const [ expanded, setExpanded ] = useState<Set<string>>(new Set());
	/* Dias abertos na lista (chave `escopo:dia`); fora do Set = recolhido, que é o padrão (pedido do Gabriel). */
	const [ open_days, setOpenDays ] = useState<Set<string>>(new Set());
	const toggleDay = (key: string) => {
		setOpenDays((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};
	const toggleExpanded = (id: string) => {
		setExpanded((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	/* Abre a aba Cartões já com o cartão escolhido aberto (atalho do cartão "Faturas do mês"). */
	/*
	 * Atalho do "Faturas do mês": abre a aba Cartões com SÓ esse cartão aberto (os outros recolhem) e rola
	 * até ele. A rolagem espera a animação de recolher (300ms) — os cartões acima encolhem e mudam a posição
	 * do alvo; rolar antes disso pararia no lugar errado.
	 */
	const [ scroll_to_section, setScrollToSection ] = useState<string | null>(null);
	const openCreditSection = (id: string) => {
		setListTab('credits');
		setExpanded(new Set([ id ]));
		setScrollToSection(id);
	};

	useEffect(() => {
		if (!scroll_to_section) return undefined;
		const timer = window.setTimeout(() => {
			document.getElementById(`credit-section-${ scroll_to_section }`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			setScrollToSection(null);
		}, 320);
		return () => window.clearTimeout(timer);
	}, [ scroll_to_section ]);

	const summary = buildSummary(data_all?.accounts, account_ids); // total do mês = SÓ contas (fluxo de caixa real)

	const has_transactions = account_txs.length + credit_txs.length > 0;
	const has_sources = accounts.length > 0 || credit_balances.length > 0;

	/*
	 * Forma funcional de propósito: o mês novo sai do estado MAIS RECENTE, nunca de uma closure antiga. No app antigo
	 * o gesto guardava o mês da primeira renderização e "pulava" meses ao ir e voltar várias vezes.
	 */
	const changeMonth = (offset: number) => {
		setMonthYear((previous) => {
			const date = new Date(previous.year, previous.month + offset, 1);
			return { month: date.getMonth(), year: date.getFullYear() };
		});
	};

	/*
	 * Troca de mês com efeito líquido (hooks/useMonthTransition): setas e "voltar ao mês atual" em qualquer tamanho;
	 * arrastar a lista pros lados no celular e nos tablets. `jump_to` = destino que não é ±1 (o mês atual).
	 */
	const is_touch_layout = useMediaQuery('(max-width: 1279px)');
	const jump_to = useRef<{ month: number; year: number } | null>(null);
	const month_transition = useMonthTransition<HTMLDivElement>({
		gesture: is_touch_layout,
		onChange: (direction) => {
			if (jump_to.current) {
				setMonthYear(jump_to.current);
				jump_to.current = null;
			} else {
				changeMonth(direction);
			}
		},
	});
	const stepMonth = (direction: 1 | -1) => month_transition.play(direction);

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

		return <span className={cn('whitespace-nowrap', className, color)}>{sign}{plainMoney(transaction_item.value)}</span>;
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
	/*
	 * Quando: o dia já está no cabeçalho do grupo, então a linha só diz a hora — "pago 13:47" ou
	 * "previsto 10:00" — e o dia previsto quando ele é diferente do dia em que foi pago. Crédito mostra só a
	 * hora da compra (ela nasce efetivada).
	 */
	const whenText = (transaction_item: TTransaction) => {
		const time = (iso: string) => format(new Date(iso), 'HH:mm');
		if (transaction_item.source_type === 'CreditBalance') return time(transaction_item.transaction_date);
		if (!transaction_item.settled_date) return `previsto ${ time(transaction_item.transaction_date) }`;

		const same_day = format(new Date(transaction_item.settled_date), 'yyyy-MM-dd') === format(new Date(transaction_item.transaction_date), 'yyyy-MM-dd');
		const planned = same_day ? '' : ` · previsto ${ format(new Date(transaction_item.transaction_date), 'dd/MM') }`;
		return `pago ${ time(transaction_item.settled_date) }${ planned }`;
	};

	/* Selos de estado da transação (rascunho, pendente, prevista, conferências). */
	const renderBadges = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const source_label = transaction_item.source_name || source_names.get(transaction_item.source_id);

		return (
			<>
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
			</>
		);
	};

	const renderMeta = (transaction_item: TTransaction, hide_source = false, hide_when = false) => {
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

				{renderBadges(transaction_item)}

				{show_author && (
					<span className='inline-flex items-center gap-1'>
						<User className='h-3 w-3' />
						{transaction_item.user_name}
					</span>
				)}

				{!hide_when && <span className='whitespace-nowrap'>{whenText(transaction_item)}</span>}
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

	const projected_sign = Math.sign(summary.projected) as -1 | 0 | 1;
	const ProjectedIcon = PROJECTED_TONE[projected_sign].Icon;

	const renderHeroCard = () => (
		<div className='relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-navy-light from-0% to-navy to-60% p-5 text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none md:p-6'>
			<div aria-hidden='true' className='pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.34)_0%,rgba(163,188,116,0)_70%)]' />

			<div className='relative grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-1'>
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
						{/* Saldo previsto no fim do mês: seta e cor pelo SINAL (sobe, desce ou fica no zero). */}
						<span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', PROJECTED_TONE[projected_sign].className)}>
							<ProjectedIcon className='h-3 w-3' strokeWidth={2.4} />
							Fim do mês {is_loading ? '…' : MoneyUtils.formatSignedMoney(summary.projected)}
						</span>
						{/*
						 * Pendentes e faturas só no celular: do tablet pra cima eles já têm lugar próprio (card
						 * Pendente / lista do destaque e o card "Faturas do mês") e aqui seriam repetição.
						 */}
						{summary.pending_count > 0 && (
							<span className='inline-flex h-7 md:hidden items-center gap-1.5 rounded-full bg-sand-light/10 px-2.5 text-xs font-medium text-[#E2DFDB]'>
								<span className='h-1.5 w-1.5 rounded-full bg-[#E9B949]' />
								{summary.pending_count} pendente{summary.pending_count > 1 ? 's' : ''}
								{summary.pending_out > 0 && <> · <span className='font-semibold text-[#F5A99F]'>{signedMoney(-summary.pending_out, true)}</span></>}
								{summary.pending_in > 0 && <> · <span className='font-semibold text-[#9FE0B6]'>{signedMoney(summary.pending_in, true)}</span></>}
							</span>
						)}
						{/*
						 * Faturas em aberto = a MESMA conta do card "Faturas do mês" (o que falta pagar das faturas do
						 * mês). Já foi a diferença "efetivado + pendentes − previsto", mas o previsto é o saldo
						 * ACUMULADO e arrasta pendentes de meses anteriores — os dois números não batiam.
						 */}
						{invoices_open > 0 && (
							<span className='inline-flex h-7 items-center gap-1.5 rounded-full bg-sand-light/10 px-2.5 text-xs font-medium text-[#E2DFDB] md:hidden'>
								<CreditCard className='h-3 w-3' />
								faturas em aberto · <span className='font-semibold text-[#F5A99F]'>{signedMoney(-invoices_open, true)}</span>
							</span>
						)}
					</div>
				</div>

				{/* Tablet: Entrou/Saiu/Pendente em lista à direita do saldo */}
				<div className='hidden flex-col justify-center gap-3.5 border-l border-sand-light/15 pl-5 text-sm md:flex lg:hidden'>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>Entrou</span><span className='font-semibold text-[#9FE0B6]'>+ {MoneyUtils.formatMoney(summary.deposit)}</span></span>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>Saiu</span><span className='font-semibold text-[#F5A99F]'>− {MoneyUtils.formatMoney(summary.withdraw)}</span></span>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>A pagar</span><span className='font-semibold text-[#F5A99F]'>{signedMoney(-summary.pending_out, true)}</span></span>
					<span className='flex justify-between gap-3'><span className='text-[#A9B6BF]'>A receber</span><span className='font-semibold text-[#9FE0B6]'>{signedMoney(summary.pending_in, true)}</span></span>
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
	/*
	 * Nos cards de resumo o sinal tem cor (entrada verde, saída vermelha; zero neutro) — é onde o número
	 * precisa saltar aos olhos. Nas linhas da lista, não: lá saída fica na cor do texto, como no mockup.
	 */
	const renderStatCard = (label: string, value: React.ReactNode, hint: string, tone: 'success' | 'neutral' | 'warning', value_class?: string) => (
		<div
			className={cn(
				'flex flex-col justify-between gap-2 rounded-3xl p-5',
				tone === 'warning' ? 'bg-warning-soft' : SURFACE,
			)}
		>
			<span className={cn('flex items-center gap-1.5 text-[13px] font-medium', tone === 'warning' ? 'font-semibold text-warning' : 'text-muted-foreground')}>
				{tone === 'warning' && <span className='h-[7px] w-[7px] rounded-full bg-warning-dot' />}
				{label}
			</span>
			{is_loading
				? <Skeleton className='h-7 w-28' />
				: <span className={cn('text-2xl font-semibold tracking-[-0.03em]', value_class)}>{value}</span>}
			<span className={cn('text-xs', tone === 'warning' ? 'text-warning' : 'text-muted-foreground')}>{hint}</span>
		</div>
	);

	/* Valor do card Pendente: a pagar e a receber em linhas separadas (um não abate o outro). */
	const renderPendingValue = () => {
		if (summary.pending_out === 0 && summary.pending_in === 0) return plainMoney(0);
		const both = summary.pending_out > 0 && summary.pending_in > 0;
		return (
			<span className={cn('flex flex-col leading-tight', both && 'text-xl')}>
				{summary.pending_out > 0 && <span className='text-danger'>{signedMoney(-summary.pending_out)}</span>}
				{summary.pending_in > 0 && <span className='text-success'>{signedMoney(summary.pending_in)}</span>}
			</span>
		);
	};

	const renderPendingCard = () => renderStatCard(
		'Pendente',
		renderPendingValue(),
		summary.pending_count > 0
			? [ summary.pending_out_count > 0 && `${ summary.pending_out_count } a pagar`, summary.pending_in_count > 0 && `${ summary.pending_in_count } a receber` ].filter(Boolean).join(' · ')
			: 'nada pendente',
		'warning',
	);

	/* Tablet deitado: Entrou e Saiu empilhados num card só (como no mockup), pra caber ao lado do destaque. */
	const renderInOutCard = () => (
		<div className={cn('flex flex-col justify-between gap-3 rounded-3xl p-[18px]', SURFACE)}>
			<span className='flex flex-col gap-0.5'>
				<span className='text-xs text-muted-foreground'>Entrou</span>
				{is_loading
					? <Skeleton className='h-6 w-24' />
					: <span className={cn('text-xl font-semibold tracking-[-0.03em]', summary.deposit > 0 && 'text-success')}>{signedMoney(summary.deposit)}</span>}
			</span>
			<span className='flex flex-col gap-0.5'>
				<span className='text-xs text-muted-foreground'>Saiu</span>
				{is_loading
					? <Skeleton className='h-6 w-24' />
					: <span className={cn('text-xl font-semibold tracking-[-0.03em]', summary.withdraw > 0 && 'text-danger')}>{signedMoney(-summary.withdraw)}</span>}
			</span>
		</div>
	);

	const plural = (count: number, singular: string, plural_word: string) => `${ count } ${ count === 1 ? singular : plural_word }`;

	/* Situação curta de uma fatura: paga, quanto falta ou quando vence. */
	const invoiceHint = (invoice?: TCurrentInvoice) => {
		if (!invoice) return '';
		if (invoice.amount <= 0) return 'sem compras';
		if (invoice.paid) return 'paga';
		if (invoice.paid_amount > 0) return `restante ${ plainMoney(invoice.remaining) }`;
		return `vence ${ formatShortDate(invoice.due_date) }`;
	};

	/*
	 * Situação no cartão azul de "Faturas do mês": paga ganha selo verde com check (e o valor apaga), em
	 * aberto fica em âmbar — dá pra bater o olho e ver o que ainda falta pagar.
	 */
	const renderInvoiceStatus = (invoice?: TCurrentInvoice) => {
		if (!invoice) return null;
		if (invoice.paid && invoice.amount > 0) {
			return (
				<span className='inline-flex items-center gap-1 rounded-full bg-[rgba(125,211,160,0.18)] px-2 py-px text-[11px] font-semibold text-[#9FE0B6]'>
					<Check className='h-3 w-3' strokeWidth={3} /> Paga
				</span>
			);
		}
		const tone = invoice.amount > 0 ? 'text-[#F2D58A]' : 'text-[#A9B6BF]';
		return <span className={cn('text-xs font-medium', tone)}>{invoiceHint(invoice)}</span>;
	};

	/*
	 * Faturas do mês (tablet e desktop), no degradê azul-petróleo do logo: TODOS os cartões com fatura ou compra
	 * no mês exibido, cada um com o total e a situação. Tocar num cartão abre a aba Cartões nele.
	 */
	const renderInvoicesCard = () => {
		if (invoice_cards.length === 0) return null;

		const total = invoice_cards.reduce((acc, card) => acc + (card.invoice?.amount ?? 0), 0);
		const all_loaded = invoice_cards.every((card) => card.invoice);

		return (
			/*
			 * Tablet em pé (768–1023px): o card ocupa a linha inteira acima da lista; em coluna única ele ficava
			 * alto e espremia a lista. Lá ele vira resumo à esquerda + cartões em duas colunas à direita. Do tablet
			 * deitado pra cima ele mora na coluna da direita, ao lado da lista, em coluna.
			 */
			<div className='flex shrink-0 flex-col gap-3 rounded-3xl bg-[radial-gradient(120%_120%_at_0%_0%,#12708A_0%,#0B3E52_50%,#082435_100%)] p-5 text-sand-light md:max-lg:grid md:max-lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:max-lg:items-start md:max-lg:gap-x-6'>
				<div className='flex flex-col gap-3'>
					<span className='flex items-baseline justify-between gap-3'>
						<span className='text-[13px] font-semibold'>Faturas do mês</span>
						<span className='text-xs text-[#A9B6BF]'>{plural(invoice_cards.length, 'cartão', 'cartões')}</span>
					</span>
					<span className='text-[30px] font-semibold leading-none tracking-[-0.04em]'>{MoneyUtils.formatMoney(total)}</span>
					{all_loaded && (
						invoices_open > 0
							? <span className='text-xs font-medium text-[#F2D58A]'>{MoneyUtils.formatMoney(invoices_open)} em aberto</span>
							: (
								<span className='inline-flex items-center gap-1 self-start rounded-full bg-[rgba(125,211,160,0.18)] px-2.5 py-0.5 text-xs font-semibold text-[#9FE0B6]'>
									<Check className='h-3 w-3' strokeWidth={3} /> Todas pagas
								</span>
							)
					)}
				</div>
				<div className='grid grid-cols-1 md:max-lg:grid-cols-2 md:max-lg:gap-x-4'>
					{invoice_cards.map((card) => (
						<button
							key={card.id}
							type='button'
							onClick={() => openCreditSection(card.id)}
							className='-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-sand-light/10'
						>
							<span className='flex min-w-0 flex-col items-start gap-0.5'>
								<span className='truncate font-medium'>{card.name}</span>
								{renderInvoiceStatus(card.invoice)}
							</span>
							<span className={cn('shrink-0 font-semibold', card.invoice?.paid && 'text-[#A9B6BF]')}>
								{card.invoice ? plainMoney(card.invoice.amount) : '…'}
							</span>
						</button>
					))}
				</div>
			</div>
		);
	};

	/* Celular: pílula da carteira (ícone do logo + nome) que abre a lista de carteiras. */
	const renderWalletPill = () => (
		<Popover open={is_wallet_menu_open} onOpenChange={setIsWalletMenuOpen}>
			<PopoverTrigger asChild>
				<button
					type='button'
					className='flex h-10 min-w-0 items-center gap-2.5 rounded-full border border-border bg-white dark:bg-[rgba(199,195,191,0.05)] pl-1 pr-3.5 text-sm font-semibold'
				>
					<Logo variant='icon' size={26} round />
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

	/*
	 * Volta pro mês atual. Só aparece quando o mês exibido não é o atual — no mês atual não tem pra onde
	 * voltar, e um botão sempre visível seria ruído.
	 */
	const goToCurrentMonth = () => {
		const target = { month: now.getMonth(), year: now.getFullYear() };
		const is_future = month_year.year * 12 + month_year.month > target.year * 12 + target.month;
		jump_to.current = target;
		month_transition.play(is_future ? -1 : 1);
	};
	const renderTodayButton = (height: string) => (
		!is_current_month && (
			<button
				type='button'
				onClick={goToCurrentMonth}
				aria-label='Voltar para o mês atual'
				className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-brand transition-colors hover:bg-accent', 'border border-border bg-white dark:bg-[rgba(199,195,191,0.05)]', height)}
			>
				<RotateCcw className='h-3.5 w-3.5' />
				Hoje
			</button>
		)
	);

	/* Celular: pílula do mês com as setas. */
	const renderMonthPill = () => (
		<div className='flex h-10 shrink-0 items-center rounded-full border border-border bg-white dark:bg-[rgba(199,195,191,0.05)]'>
			<button type='button' onClick={() => stepMonth(-1)} aria-label='Mês anterior' className='flex h-10 w-9 items-center justify-center text-muted-foreground'>
				<ChevronLeft className='h-3.5 w-3.5' />
			</button>
			<span className='text-[13px] font-semibold capitalize'>{short_month_label}</span>
			<button type='button' onClick={() => stepMonth(1)} aria-label='Próximo mês' className='flex h-10 w-9 items-center justify-center text-muted-foreground'>
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
				<DropdownMenuItem onClick={() => setDetailId(transaction_item.id)}>
					<Info className='mr-2 h-4 w-4' /> Detalhes
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{!transaction_item.draft && (
					transaction_item.settled
						? (
							<DropdownMenuItem onClick={() => handleUnsettle(transaction_item)}>
								<CircleDashed className='mr-2 h-4 w-4' /> Desfazer pagamento
							</DropdownMenuItem>
						)
						: (
							<DropdownMenuItem onClick={() => openSettle(transaction_item)}>
								<CheckCircle2 className='mr-2 h-4 w-4' /> Marcar como pago
							</DropdownMenuItem>
						)
				)}
				{/* Transferência não é editável — só duplicar, efetivar/desfazer e excluir. */}
				{transaction_item.kind !== 'transfer' && (
					<DropdownMenuItem onClick={() => setEditingTransaction(transaction_item)}>
						<Pencil className='mr-2 h-4 w-4' /> Editar
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onClick={() => setDuplicatingTransaction(transaction_item)}>
					<Copy className='mr-2 h-4 w-4' /> Duplicar
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className='text-destructive' onClick={() => setDeletingTransaction(transaction_item)}>
					<Trash2 className='mr-2 h-4 w-4' /> Excluir
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	/* ----- Transação em duas linhas (todos os tamanhos) ----- */
	/*
	 * Detalhe da transação (painel/tela cheia). As ações são as mesmas do "⋮"; editar, duplicar e excluir
	 * fecham o Detalhe antes de abrir o diálogo deles. Se a transação some da lista (excluída), ele fecha.
	 */
	const detail_transaction = detail_id ? [ ...account_txs, ...credit_txs ].find((item) => item.id === detail_id) ?? null : null;
	const renderDetail = () => {
		const item = detail_transaction;
		const source_label = item ? (item.source_name || source_names.get(item.source_id) || '') : '';
		const source_text = (() => {
			if (!item) return '';
			if (item.kind === 'transfer') return `${ source_label } → ${ item.destination_account_name || 'Conta' }`;
			return isDeletedSource(item) ? `${ source_label } (excluída)` : source_label;
		})();
		const closeThen = (action: ()=> void) => () => {
			setDetailId(null);
			action();
		};

		return (
			<TransactionDetailSheet
				transaction={item}
				open={Boolean(item)}
				onOpenChange={(open) => !open && setDetailId(null)}
				direction={item ? directionOf(item) : 'out'}
				sourceLabel={source_text}
				onEdit={item && item.kind !== 'transfer' ? closeThen(() => setEditingTransaction(item)) : undefined}
				onDuplicate={closeThen(() => item && setDuplicatingTransaction(item))}
				onDelete={closeThen(() => item && setDeletingTransaction(item))}
				onSettle={() => item && openSettle(item)}
				onUnsettle={() => item && handleUnsettle(item)}
				onReviewMatch={item ? closeThen(() => setReviewingMatchSource({
					type: item.source_type,
					id: item.source_id,
					name: source_label || (item.source_type === 'CreditBalance' ? 'Crédito' : 'Conta'),
				})) : undefined}
			/>
		);
	};

	/* Tocar na linha abre o Detalhe; o "⋮" continua com as ações rápidas (e não abre o Detalhe). */
	const renderRow = (transaction_item: TTransaction, hide_source = false) => (
		<div
			key={transaction_item.id}
			role='button'
			tabIndex={0}
			aria-label={`Ver ${ transaction_item.description }`}
			onClick={() => setDetailId(transaction_item.id)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					setDetailId(transaction_item.id);
				}
			}}
			className={cn(
				/*
				 * Hover vale só com mouse (`future.hoverOnlyWhenSupported` no tailwind.config). No toque, só o afundar rápido
				 * do `:active`, voltando com mola. Cor: um véu do texto sobre o cartão (`foreground/4%`), não `accent` — no
				 * escuro o accent é mais escuro que o cartão e a linha parecia um buraco recortado.
				 */
				'-mx-2 flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 [-webkit-tap-highlight-color:transparent] [transition:background-color_150ms,transform_320ms_cubic-bezier(0.34,1.45,0.64,1)] focus-visible:bg-foreground/[0.05] focus-visible:outline-none active:scale-[0.985] active:bg-foreground/[0.06] active:[transition-duration:80ms] hover:bg-foreground/[0.04]',
				transaction_item.draft && 'opacity-60',
			)}
		>
			<div className='flex min-w-0 flex-1 flex-col'>
				<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
					<span className='truncate'>{transaction_item.description}</span>
					{renderRecurrenceIcon(transaction_item)}
				</span>
				{renderMeta(transaction_item, hide_source)}
			</div>

			{renderValue(transaction_item, 'shrink-0 text-[15px] font-semibold')}

			{/* `stopPropagation`: o menu (e os itens dele, que estão num portal mas na mesma árvore React) não abre o Detalhe. */}
			<div className='shrink-0' onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
				{renderActionsMenu(transaction_item)}
			</div>
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

	/*
	 * Todo dia começa recolhido — inclusive os de uma transação só — e abre tocando no cabeçalho (o total e a
	 * contagem do dia ficam sempre visíveis). `scope` separa a lista de contas da seção de cada cartão, que têm
	 * dias iguais.
	 */
	const renderDayGroups = (items: TTransaction[], scope: string, hide_source = false) =>
		groupTransactionsByDay(items).map((group) => {
			const net = dayNet(group.items);
			const key = `${ scope }:${ group.label }`;
			const is_collapsed = !open_days.has(key);

			return (
				<section key={group.label} aria-label={group.label}>
					<button
						type='button'
						onClick={() => toggleDay(key)}
						aria-expanded={!is_collapsed}
						className='flex w-full items-baseline justify-between pb-1.5 pt-4 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground'
					>
						<span className='flex items-center gap-1.5'>
							{group.label}
							<span className='font-medium opacity-70'>· {group.items.length}</span>
							<ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', is_collapsed && '-rotate-90')} />
						</span>
						{net !== 0 && <span>{signedMoney(net)}</span>}
					</button>

					{/* Altura animada via grid-rows (0fr↔1fr), sem JS */}
					<div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', is_collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
						{/* `-mx-2 px-2` (aqui e nas áreas de cima): folga pro fundo do hover da linha, que avança 8px pros lados,
						    não ter os cantos cortados por quem tem overflow escondido. O conteúdo não se mexe. */}
						<div className='-mx-2 min-h-0 overflow-hidden px-2'>
							{group.items.map((transaction_item) => renderRow(transaction_item, hide_source))}
						</div>
					</div>
				</section>
			);
		});

	/* Situação da fatura no cabeçalho do cartão (aba Cartões): selo verde "Paga" ou âmbar em aberto. */
	const renderSectionInvoiceStatus = (invoice?: TCurrentInvoice) => {
		if (!invoice) return null;
		if (invoice.paid && invoice.amount > 0) {
			return (
				<Badge variant='success' className='px-2 py-0 text-[11px]'>
					<Check className='h-3 w-3' strokeWidth={3} /> Paga
				</Badge>
			);
		}
		return <span className={cn('truncate', invoice.amount > 0 && 'font-medium text-warning')}>· {invoiceHint(invoice)}</span>;
	};

	const renderCreditSection = (section: TCreditSection) => {
		const is_open = expanded.has(section.id);

		return (
			<section key={section.id} id={`credit-section-${ section.id }`} aria-label={section.name} className='scroll-mt-2 border-b border-border last:border-b-0'>
				<button
					type='button'
					onClick={() => toggleExpanded(section.id)}
					aria-expanded={is_open}
					className='flex w-full items-center gap-3 py-3 text-left'
				>
					<span className='flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-info-soft text-info'>
						<CreditCard className='h-[18px] w-[18px]' />
					</span>
					<span className='flex min-w-0 flex-1 flex-col'>
						<span className='truncate text-[15px] font-semibold'>{section.name}</span>
						<span className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
							<span className='truncate'>{plural(section.items.length, 'lançamento', 'lançamentos')}</span>
							{renderSectionInvoiceStatus(invoices.get(section.id))}
						</span>
					</span>
					<span className={cn('shrink-0 text-[15px] font-semibold', invoices.get(section.id)?.paid && 'text-muted-foreground')}>
						{invoices.get(section.id) ? plainMoney(invoices.get(section.id)!.amount) : '…'}
					</span>
					<ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300', !is_open && '-rotate-90')} />
				</button>

				{/* Altura animada via grid-rows (0fr↔1fr), sem JS */}
				<div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', is_open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
					<div className='overflow-hidden'>
						<div className='pb-2 pl-[54px]'>{renderDayGroups(section.items, section.id, true)}</div>
					</div>
				</div>
			</section>
		);
	};

	const renderTabsRow = () => (
		<>
			{renderTabs()}
			<span className='text-xs text-muted-foreground'>{plural(tab_txs.length, 'transação', 'transações')}</span>
		</>
	);

	const renderTabs = () => (
		<SegmentedControl
			className='w-[180px] shrink-0'
			segments={[ { value: 'accounts', label: 'Contas' }, { value: 'credits', label: 'Cartões' } ]}
			value={list_tab}
			onChange={(value) => setListTab(value as TListTab)}
		/>
	);

	const tab_empty_text = list_tab === 'accounts' ? 'Nenhuma transação em contas neste mês' : 'Nenhuma compra no cartão neste mês';

	const month_label = format(new Date(month_year.year, month_year.month, 1), 'MMMM yyyy', { locale: ptBR });
	const show_side_cards = invoice_cards.length > 0;

	return (
		/*
		 * Celular: a Home vai até o rodapé da tela e a lista passa POR TRÁS da barra flutuante de vidro. O
		 * template reserva `--bottom-nav-space` como padding; aqui a altura soma esse padding de volta e o
		 * respiro vai pro fim da área rolável (a última linha ainda para acima da barra).
		 */
		<div className='-mx-2 flex h-[calc(100%+var(--bottom-nav-space))] flex-col gap-4 overflow-x-clip px-2 md:h-full md:gap-5'>
			{/* 1a. Celular: pílula da carteira + (fora do mês atual) "Hoje" + pílula do mês */}
			<div className='flex items-center gap-2 md:hidden'>
				{renderWalletPill()}
				<div className='ml-auto flex shrink-0 items-center gap-2'>
					{renderTodayButton('h-10')}
					{renderMonthPill()}
				</div>
			</div>

			{/* 1b. Tablet e desktop: carteira (só no tablet — no desktop está na barra lateral) + mês + Nova transação */}
			<header className='hidden items-center justify-between gap-3 md:flex'>
				<div className='flex min-w-0 flex-col gap-0.5'>
					{user_wallet.data?.name && <span className='truncate text-[13px] font-medium text-muted-foreground xl:hidden'>{user_wallet.data.name}</span>}
					<div className='flex items-center gap-2.5'>
						<h1 className='text-2xl font-bold capitalize tracking-[-0.03em] xl:text-[26px]'>{month_label}</h1>
						<Button type='button' variant='outline' size='icon' className='h-[34px] w-[34px] bg-card text-muted-foreground' onClick={() => stepMonth(-1)} aria-label='Mês anterior'>
							<ChevronLeft className='h-3.5 w-3.5' />
						</Button>
						<Button type='button' variant='outline' size='icon' className='h-[34px] w-[34px] bg-card text-muted-foreground' onClick={() => stepMonth(1)} aria-label='Próximo mês'>
							<ChevronRight className='h-3.5 w-3.5' />
						</Button>
						{renderTodayButton('h-[34px]')}
					</div>
				</div>

				<Button type='button' onClick={() => setIsNewTransactionOpen(true)} disabled={!wallet_id} className='h-11 shrink-0 px-5'>
					<Plus className='h-4 w-4' strokeWidth={2.6} />
					Nova transação
				</Button>
			</header>

			{/* 2. Destaque do mês (só contas) + Entrou/Saiu/Pendente ao lado no desktop */}
			{/*
			 * Linha do destaque por tamanho: celular/tablet em pé = só o destaque (Entrou/Saiu/Pendente dentro dele);
			 * tablet deitado (1024–1279px) = destaque + card Entrou/Saiu + card Pendente; desktop = destaque + 3 cards.
			 */}
			<section className='grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]'>
				{renderHeroCard()}
				<div className='hidden lg:max-xl:contents'>
					{renderInOutCard()}
					{renderPendingCard()}
				</div>
				<div className='hidden xl:contents'>
					{renderStatCard('Entrou', signedMoney(summary.deposit), plural(summary.deposit_count, 'lançamento', 'lançamentos'), 'success', summary.deposit > 0 ? 'text-success' : undefined)}
					{renderStatCard('Saiu', signedMoney(-summary.withdraw), plural(summary.withdraw_count, 'lançamento', 'lançamentos'), 'neutral', summary.withdraw > 0 ? 'text-danger' : undefined)}
					{renderPendingCard()}
				</div>
			</section>

			{/* 3. Tablet: faturas do mês */}
			{show_side_cards && (
				<section className='hidden md:block lg:hidden'>
					{renderInvoicesCard()}
				</section>
			)}

			{/*
			 * Celular: as abas ficam FORA da área rolável — cabeçalho, destaque e abas fixos; só a lista rola.
			 * (No tablet/desktop elas moram dentro do cartão da lista, presas no topo com sticky.)
			 */}
			{!is_loading && has_sources && (
				<div className='-mb-2 flex items-center justify-between gap-3 md:hidden'>{renderTabsRow()}</div>
			)}

			{/* 4. Transações */}
			<div ref={month_transition.ref} className='no-scrollbar -mx-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-[var(--bottom-nav-space)] [will-change:transform] md:overflow-hidden md:pb-0'>
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
						<Button type='button' variant='secondary' onClick={() => navigate('/contas')}>
							Ir para Contas &amp; Cartões
						</Button>
					</div>
				)}

				{!is_loading && has_sources && (
					<div className={cn('grid grid-cols-[minmax(0,1fr)] gap-4 md:h-full', show_side_cards && 'lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]')}>
						<div className='flex flex-col md:min-h-0 md:rounded-3xl md:px-5 md:pt-4 xl:px-[22px] md:border md:border-border md:bg-white md:shadow-[0_1px_2px_rgba(8,36,53,0.05)] md:dark:bg-[rgba(199,195,191,0.04)] md:dark:shadow-none'>
							{/* Tablet/desktop: abas fixas no topo do cartão; só o corpo dele rola */}
							<div className='hidden shrink-0 items-center justify-between gap-3 pb-2 md:flex'>
								{renderTabsRow()}
							</div>

							<div className='no-scrollbar md:-mx-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-2 md:pb-2'>

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

								{has_transactions && tab_txs.length > 0 && list_tab === 'credits' && (
									<div className='flex flex-col pt-1'>{credit_sections.map(renderCreditSection)}</div>
								)}

								{has_transactions && tab_txs.length > 0 && list_tab === 'accounts' && (
									<>
										{/* Agrupado por dia em todos os tamanhos (no desktop, dentro do cartão com as abas) */}
										{renderDayGroups(tab_txs, 'accounts')}
									</>
								)}
							</div>
						</div>

						{/* Desktop: faturas do mês na coluna da direita */}
						{show_side_cards && (
							<div className='no-scrollbar hidden min-h-0 flex-col gap-4 overflow-y-auto lg:flex'>
								{renderInvoicesCard()}
							</div>
						)}
					</div>
				)}
			</div>

			{renderDetail()}

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

			{/* Duplicar = o mesmo formulário da nova transação, já preenchido com a original (tudo editável). */}
			<TransactionFormDialog
				open={Boolean(duplicating_transaction)}
				onOpenChange={(open) => !open && setDuplicatingTransaction(null)}
				duplicateFrom={duplicating_transaction}
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
						<DialogTitle>Marcar como pago</DialogTitle>
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
							Marcar como pago
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default TransactionList;
