import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, type TTransaction, type TTransactionSourceType } from '@myfinance/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
	ArrowDown,
	ArrowDownRight,
	ArrowUp,
	ArrowUpDown,
	ArrowUpRight,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CircleDashed,
	CreditCard,
	Info,
	Loader2,
	MoreVertical,
	Plus,
	Receipt,
	Wallet,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteTransactions } from '@/hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import { useSettleTransaction } from '@/hooks/api/transactions/useSettleTransaction';
import { useUnsettleTransaction } from '@/hooks/api/transactions/useUnsettleTransaction';
import useToast from '@/hooks/useToast';

import { useMonthSelection } from '@/context/monthSelection';
import { useNewTransactionDialog } from '@/context/newTransactionDialog';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TSortField = 'transaction_date' | 'description' | 'kind' | 'value';
type TSortState = { field: TSortField; direction: 'asc' | 'desc' };

/*
 * A separação é só por TIPO de origem (a aba). Não filtramos por origem específica: o backend já traz
 * o mês inteiro, então a aba filtra por `source_type` no cliente — sem dropdown de source_id.
 */
const SOURCE_TABS: { id: TTransactionSourceType; label: string; icon: typeof Wallet }[] = [
	{ id: 'Account', label: 'Contas', icon: Wallet },
	{ id: 'CreditBalance', label: 'Cartões', icon: CreditCard },
];

const groupLabel = (date: Date) => {
	if (isToday(date)) return 'Hoje';
	if (isYesterday(date)) return 'Ontem';
	return format(date, 'd \'de\' MMMM', { locale: ptBR });
};

const groupTransactionsByDay = (transactions: TTransaction[]) => {
	const groups = new Map<string, { label: string; items: TTransaction[] }>();

	transactions.forEach((transaction_item) => {
		const date = new Date(transaction_item.transaction_date);
		const key = format(date, 'yyyy-MM-dd');

		if (!groups.has(key)) {
			groups.set(key, { label: groupLabel(date), items: [] });
		}
		groups.get(key)!.items.push(transaction_item);
	});

	return Array.from(groups.values());
};

/*
 * Resumo calculado 100% no cliente a partir da lista (o backend traz o mês inteiro). Assim funciona
 * pra qualquer recorte — todas as origens ou só um tipo — sem depender do total_settled/projected da
 * resposta (que é sempre "de tudo"). Espelha a lógica do backend: efetivado = entre os não-rascunho E
 * efetivados, entradas - saídas; previsto = entre todos os não-rascunho, entradas - saídas.
 */
const buildSummary = (items: TTransaction[]) => {
	const non_draft = items.filter((item) => !item.draft);
	const sum = (list: TTransaction[]) =>
		list.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0)
		- list.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0);

	const deposit = non_draft.filter((i) => i.kind === 'deposit').reduce((acc, i) => acc + i.value, 0);
	const withdraw = non_draft.filter((i) => i.kind === 'withdraw').reduce((acc, i) => acc + i.value, 0);
	const projected = sum(non_draft);
	const settled = sum(non_draft.filter((i) => i.settled));
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
	const [ source_type, setSourceType ] = useState<TTransactionSourceType>('Account');
	const [ editing_transaction, setEditingTransaction ] = useState<TTransaction | null>(null);
	const [ deleting_transaction, setDeletingTransaction ] = useState<TTransaction | null>(null);
	const [ sort, setSort ] = useState<TSortState>({ field: 'transaction_date', direction: 'desc' });

	const wallet_id = user_wallet.data?.id;
	const reference = `${ month_year.year }-${ String(month_year.month + 1).padStart(2, '0') }`;

	// Uma única busca: o mês inteiro (todas as origens). A aba filtra por tipo no cliente.
	const { data: data_all, isLoading: is_transactions_loading } = useListTransactions({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '', reference },
	});

	/* Contas/créditos: pra resolver o nome da origem de cada linha e pra guiar o empty-state. */
	const { data: accounts_data, isLoading: is_accounts_loading } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });
	const { data: credit_balances_data, isLoading: is_credit_loading } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });

	const accounts = accounts_data?.data || [];
	const credit_balances = credit_balances_data?.data || [];
	const sources_of_type = source_type === 'Account' ? accounts : credit_balances;

	const source_names = useMemo(() => {
		const map = new Map<string, string>();
		accounts.forEach((account) => map.set(account.id, account.name));
		credit_balances.forEach((credit_balance) => map.set(credit_balance.id, credit_balance.name));
		return map;
	}, [ accounts, credit_balances ]);

	const is_loading = is_wallet_loading || is_transactions_loading || is_accounts_loading || is_credit_loading;

	const { mutate: deleteTransactionMutation, isPending: is_delete_pending } = useDeleteTransactions();
	const { mutate: settleTransactionMutation } = useSettleTransaction();
	const { mutate: unsettleTransactionMutation } = useUnsettleTransaction();

	const all_transactions = data_all?.data || [];
	const transactions = all_transactions.filter((item) => item.source_type === source_type);
	const groups = useMemo(() => groupTransactionsByDay(transactions), [ transactions ]);
	const sorted_transactions = useMemo(() => sortTransactions(transactions, sort), [ transactions, sort ]);

	const summary = buildSummary(transactions); // tipo (aba) atual — só desktop
	const grand = buildSummary(all_transactions); // todas as origens (total do mês)

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

	const handleToggleSettle = (transaction_item: TTransaction) => {
		if (transaction_item.settled) {
			unsettleTransactionMutation({
				id: transaction_item.id,
				onSuccess: () => toast.success('Efetivação desfeita'),
				onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível desfazer')),
			});
			return;
		}
		settleTransactionMutation({
			id: transaction_item.id,
			onSuccess: () => toast.success('Transação efetivada'),
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
	 * Dentro de uma aba (tipo) há vários sources misturados, então mostramos o NOME da origem por linha
	 * (qual conta / qual crédito), colorido por tipo, mais os badges de estado (pendente/rascunho).
	 */
	const renderMeta = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const name = source_names.get(transaction_item.source_id);
		const is_pending = !transaction_item.draft && !transaction_item.settled;

		return (
			<div className='mt-0.5 flex flex-wrap items-center gap-1.5'>
				<span
					className={cn(
						'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
						is_credit ? 'border-feedback-info-default/50 text-feedback-info-default' : 'border-brand-secondary/50 text-brand-secondary',
					)}
				>
					{is_credit ? <CreditCard className='h-3 w-3' /> : <Wallet className='h-3 w-3' />}
					{name || (is_credit ? 'Crédito' : 'Conta')}
				</span>

				{transaction_item.draft && (
					<span className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground'>Rascunho</span>
				)}
				{is_pending && (
					<span className='rounded bg-feedback-warning-light px-1.5 py-0.5 text-[10px] font-semibold uppercase text-feedback-warning-dark'>Pendente</span>
				)}
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
	 * Card do total do mês. No mobile fica minimalista (rótulo + saldo/previsto) com um botão "i" que
	 * abre o detalhe arrumadinho (efetivado/previsto/entradas/saídas) num popover — assim sobra tela pra
	 * lista. No desktop, entrada/saída já aparecem inline à direita (sem precisar do "i").
	 */
	const renderMonthTotals = () => (
		<div className='rounded-lg border border-card bg-card px-4 py-2.5 sm:py-3'>
			<div className='flex items-center gap-3'>
				<div className='flex flex-1 flex-col gap-0.5 sm:flex-none'>
					<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						Total do mês<span className='hidden sm:inline'> · todas as origens</span>
					</span>
					{is_loading ? (
						<Skeleton className='h-5 w-28' />
					) : (
						<div className='flex flex-wrap items-baseline gap-x-2'>
							<span className={cn('text-base font-semibold', grand.settled >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
								{MoneyUtils.formatMoney(grand.settled)}
							</span>
							<span className='text-xs text-muted-foreground'>
								previsto <span className={cn('font-medium', grand.gap ? 'text-feedback-warning-dark' : 'text-foreground')}>{MoneyUtils.formatMoney(grand.projected)}</span>
								{grand.pending_suffix}
							</span>
						</div>
					)}
				</div>

				{/* Desktop: entrada/saída inline à direita */}
				<div className='ml-auto hidden items-center gap-6 sm:flex'>
					{renderEntry(ArrowUpRight, 'bg-feedback-success-light text-feedback-success-dark', 'text-feedback-success-default', grand.deposit)}
					{renderEntry(ArrowDownRight, 'bg-feedback-danger-light text-feedback-danger-dark', 'text-destructive', grand.withdraw)}
				</div>

				{/* Mobile: botão "i" com o detalhe arrumadinho num popover */}
				<Popover>
					<PopoverTrigger asChild>
						<button
							type='button'
							aria-label='Ver detalhes do total do mês'
							className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground sm:hidden'
						>
							<Info className='h-4 w-4' />
						</button>
					</PopoverTrigger>
					<PopoverContent align='end' className='w-64'>
						<div className='flex flex-col gap-3'>
							<span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>Total do mês · todas as origens</span>
							<div className='flex flex-col gap-2 text-sm'>
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Saldo efetivado</span>
									<span className={cn('font-semibold', grand.settled >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>{MoneyUtils.formatMoney(grand.settled)}</span>
								</div>
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Saldo previsto</span>
									<span className={cn('font-medium', grand.gap ? 'text-feedback-warning-dark' : 'text-foreground')}>{MoneyUtils.formatMoney(grand.projected)}</span>
								</div>
								<div className='my-1 border-t border-border' />
								<div className='flex items-center justify-between'>
									<span className='flex items-center gap-1.5 text-muted-foreground'><ArrowUpRight className='h-3.5 w-3.5 text-feedback-success-default' /> Entradas</span>
									<span className='font-medium text-feedback-success-default'>{MoneyUtils.formatMoney(grand.deposit)}</span>
								</div>
								<div className='flex items-center justify-between'>
									<span className='flex items-center gap-1.5 text-muted-foreground'><ArrowDownRight className='h-3.5 w-3.5 text-destructive' /> Saídas</span>
									<span className='font-medium text-destructive'>{MoneyUtils.formatMoney(grand.withdraw)}</span>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);

	/* Subtotal do tipo (aba) atual — só no desktop, onde sobra espaço; no mobile o "i" do total cobre. */
	const renderTypeTotals = () => (
		<div className='hidden rounded-lg border border-card bg-card px-4 py-3 sm:block'>
			<div className='flex items-center justify-between gap-6'>
				<div className='flex flex-col'>
					<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
						Saldo · {source_type === 'Account' ? 'Contas' : 'Cartões'}
					</span>
					{is_loading ? (
						<Skeleton className='h-5 w-28' />
					) : (
						<div className='flex flex-wrap items-baseline gap-x-2'>
							<span className={cn('text-base font-semibold', summary.settled >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
								{MoneyUtils.formatMoney(summary.settled)}
							</span>
							<span className='text-xs text-muted-foreground'>
								previsto <span className={cn('font-medium', summary.gap ? 'text-feedback-warning-dark' : 'text-foreground')}>{MoneyUtils.formatMoney(summary.projected)}</span>
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
					<DropdownMenuItem onClick={() => handleToggleSettle(transaction_item)}>
						{transaction_item.settled
							? <><CircleDashed className='mr-2 h-4 w-4' /> Desfazer efetivação</>
							: <><CheckCircle2 className='mr-2 h-4 w-4' /> Efetivar</>}
					</DropdownMenuItem>
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

				{/* 2. Card compacto com o total do mês (todas as origens) */}
				{renderMonthTotals()}

				{/* 3. Abas por tipo de origem (Contas | Cartões) */}
				<div className='flex gap-1 rounded-lg bg-muted p-1'>
					{SOURCE_TABS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							type='button'
							onClick={() => setSourceType(id)}
							className={cn(
								'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
								source_type === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
							)}
						>
							<Icon className='h-4 w-4' />
							{label}
						</button>
					))}
				</div>

				{/* Subtotal do tipo selecionado — visível só no desktop */}
				{renderTypeTotals()}
			</div>

			<div className='flex-1 overflow-y-auto'>
				{is_loading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className='h-14 w-full' />
						))}
					</div>
				)}

				{/* Sem nenhuma origem do tipo escolhido → manda cadastrar em Contas & Cartões */}
				{!is_loading && transactions.length === 0 && sources_of_type.length === 0 && (
					<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center'>
						{source_type === 'Account' ? <Wallet className='h-10 w-10 text-muted-foreground' /> : <CreditCard className='h-10 w-10 text-muted-foreground' />}
						<div className='flex flex-col gap-1'>
							<span className='font-medium'>
								{source_type === 'Account' ? 'Nenhuma conta ainda' : 'Nenhum cartão de crédito ainda'}
							</span>
							<span className='text-sm text-muted-foreground'>
								Crie {source_type === 'Account' ? 'uma conta' : 'um crédito'} em Contas &amp; Cartões para ver as transações aqui.
							</span>
						</div>
						<Button type='button' variant='secondary' onClick={() => navigate('/accounts')} className='gap-2'>
							Ir para Contas &amp; Cartões
						</Button>
					</div>
				)}

				{!is_loading && transactions.length === 0 && sources_of_type.length > 0 && (
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

				{!is_loading && transactions.length > 0 && (
					<div className='mb-6'>
						{/* Desktop: tabela ordenável — dados tabulares combinam melhor com a largura disponível */}
						<div className='hidden rounded-lg border border-card bg-card md:block'>
							<Table>
								<TableHeader>
									<TableRow className='hover:bg-transparent'>
										<TableHead className='w-32'>
											<button type='button' onClick={() => toggleSort('transaction_date')} className='flex items-center gap-1 hover:text-foreground'>
												Data {renderSortIcon('transaction_date')}
											</button>
										</TableHead>
										<TableHead>
											<button type='button' onClick={() => toggleSort('description')} className='flex items-center gap-1 hover:text-foreground'>
												Descrição {renderSortIcon('description')}
											</button>
										</TableHead>
										<TableHead className='w-32'>
											<button type='button' onClick={() => toggleSort('kind')} className='flex items-center gap-1 hover:text-foreground'>
												Tipo {renderSortIcon('kind')}
											</button>
										</TableHead>
										<TableHead className='w-40 text-right'>
											<button type='button' onClick={() => toggleSort('value')} className='ml-auto flex items-center gap-1 hover:text-foreground'>
												Valor {renderSortIcon('value')}
											</button>
										</TableHead>
										<TableHead className='w-12' />
									</TableRow>
								</TableHeader>
								<TableBody>
									{sorted_transactions.map((transaction_item) => {
										const is_deposit = transaction_item.kind === 'deposit';

										return (
											<TableRow key={transaction_item.id} className={cn(transaction_item.draft && 'opacity-60')}>
												<TableCell className='text-muted-foreground'>
													{format(new Date(transaction_item.transaction_date), 'dd/MM/yyyy')}
												</TableCell>
												<TableCell>
													<div className='flex flex-col'>
														<span className='font-medium'>{transaction_item.description}</span>
														{renderMeta(transaction_item)}
													</div>
												</TableCell>
												<TableCell>
													<div className='flex items-center gap-2'>
														{renderKindIcon(transaction_item)}
														{is_deposit ? 'Entrada' : 'Saída'}
													</div>
												</TableCell>
												<TableCell className={cn('text-right font-semibold', is_deposit ? 'text-feedback-success-default' : 'text-destructive')}>
													{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
												</TableCell>
												<TableCell>{renderActionsMenu(transaction_item)}</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>

						{/* Mobile: cards agrupados por dia — tabela não funciona bem em tela estreita */}
						<div className='flex flex-col gap-4 md:hidden'>
							{groups.map((group) => (
								<div key={group.label} className='flex flex-col gap-2'>
									<span className='text-xs font-medium uppercase text-muted-foreground'>{group.label}</span>

									<div className='flex flex-col gap-2'>
										{group.items.map((transaction_item) => {
											const is_deposit = transaction_item.kind === 'deposit';

											return (
												<div
													key={transaction_item.id}
													className={cn('flex items-center gap-3 rounded-xl border border-card bg-card p-3', transaction_item.draft && 'opacity-60')}
												>
													{renderKindIcon(transaction_item)}

													<div className='flex flex-1 flex-col overflow-hidden'>
														<span className='truncate text-sm font-medium'>{transaction_item.description}</span>
														{renderMeta(transaction_item)}
													</div>

													<span className={cn('shrink-0 text-sm font-semibold', is_deposit ? 'text-feedback-success-default' : 'text-destructive')}>
														{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
													</span>

													{renderActionsMenu(transaction_item)}
												</div>
											);
										})}
									</div>
								</div>
							))}
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
		</div>
	);
};

export default TransactionList;
