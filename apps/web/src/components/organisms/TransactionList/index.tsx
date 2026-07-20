import { useMemo, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TTransaction } from '@myfinance/shared';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TSortField = 'transaction_date' | 'description' | 'kind' | 'value';
type TSortState = { field: TSortField; direction: 'asc' | 'desc' };

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
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const { month_year, setMonthYear } = useMonthSelection();
	const [ editing_transaction, setEditingTransaction ] = useState<TTransaction | null>(null);
	const [ deleting_transaction, setDeletingTransaction ] = useState<TTransaction | null>(null);
	const [ sort, setSort ] = useState<TSortState>({ field: 'transaction_date', direction: 'desc' });

	const wallet_id = user_wallet.data?.id;
	const reference = `${ month_year.year }-${ String(month_year.month + 1).padStart(2, '0') }`;

	// `enabled` evita bater na API com wallet_id vazio antes da carteira carregar.
	// O index de transações não é paginado (backend retorna o mês inteiro), então basta buscar uma vez.
	const { data: data_transactions, isLoading: is_transactions_loading } = useListTransactions({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '', reference },
	});

	/*
	 * Índices de contas/créditos só pra resolver o NOME da origem de cada transação (o payload da
	 * transação traz só `source_id`). Ficam em cache e são compartilhados com a tela Contas & Cartões.
	 */
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id: wallet_id || '' } });

	const source_names = useMemo(() => {
		const map = new Map<string, string>();
		(accounts_data?.data || []).forEach((account) => map.set(account.id, account.name));
		(credit_balances_data?.data || []).forEach((credit_balance) => map.set(credit_balance.id, credit_balance.name));
		return map;
	}, [ accounts_data, credit_balances_data ]);

	const is_loading = is_wallet_loading || is_transactions_loading;

	const { mutate: deleteTransactionMutation, isPending: is_delete_pending } = useDeleteTransactions();
	const { mutate: settleTransactionMutation } = useSettleTransaction();
	const { mutate: unsettleTransactionMutation } = useUnsettleTransaction();

	const transactions = data_transactions?.data || [];
	const groups = useMemo(() => groupTransactionsByDay(transactions), [ transactions ]);
	const sorted_transactions = useMemo(() => sortTransactions(transactions, sort), [ transactions, sort ]);

	const non_draft = transactions.filter((item) => !item.draft);
	const total_deposit = non_draft.filter((item) => item.kind === 'deposit').reduce((acc, item) => acc + item.value, 0);
	const total_withdraw = non_draft.filter((item) => item.kind === 'withdraw').reduce((acc, item) => acc + item.value, 0);
	const total_settled = Number(data_transactions?.total_settled ?? 0);
	const total_projected = Number(data_transactions?.total_projected ?? 0);
	const pending_count = transactions.filter((item) => !item.settled && !item.draft).length;
	const has_projection_gap = total_projected !== total_settled;
	const pending_suffix = pending_count > 0 ? ` · ${ pending_count } pendente${ pending_count > 1 ? 's' : '' }` : '';

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

	const renderSourceMeta = (transaction_item: TTransaction) => {
		const is_credit = transaction_item.source_type === 'CreditBalance';
		const name = source_names.get(transaction_item.source_id);

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
				{!transaction_item.draft && !transaction_item.settled && (
					<span className='rounded bg-feedback-warning-light px-1.5 py-0.5 text-[10px] font-semibold uppercase text-feedback-warning-dark'>Pendente</span>
				)}
			</div>
		);
	};

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
				<div className='flex flex-wrap items-center justify-center gap-3 md:justify-between'>
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
						className='hidden gap-2 md:inline-flex'
					>
						<Plus className='h-4 w-4' />
						Nova Transação
					</Button>
				</div>

				<div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-card bg-card px-4 py-3'>
					<div className='flex flex-col'>
						<span className='text-xs font-medium uppercase text-muted-foreground'>Saldo</span>
						{is_loading ? (
							<Skeleton className='h-5 w-24' />
						) : (
							<div className='flex flex-wrap items-baseline gap-x-2'>
								<span className={cn('text-base font-semibold', total_settled >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
									{MoneyUtils.formatMoney(total_settled)}
								</span>
								{/* Previsto sempre visível (mesmo sem pendentes) — cor de alerta só quando difere do efetivado. */}
								<span className='text-xs text-muted-foreground'>
									previsto <span className={cn('font-medium', has_projection_gap ? 'text-feedback-warning-dark' : 'text-foreground')}>{MoneyUtils.formatMoney(total_projected)}</span>
									{pending_suffix}
								</span>
							</div>
						)}
					</div>

					<div className='flex items-center gap-6'>
						<div className='flex flex-col'>
							<span className='text-xs font-medium uppercase text-muted-foreground'>Entrada</span>
							{is_loading ? <Skeleton className='h-4 w-16' /> : (
								<span className='text-sm font-medium text-feedback-success-default'>{MoneyUtils.formatMoney(total_deposit)}</span>
							)}
						</div>

						<div className='flex flex-col'>
							<span className='text-xs font-medium uppercase text-muted-foreground'>Saída</span>
							{is_loading ? <Skeleton className='h-4 w-16' /> : (
								<span className='text-sm font-medium text-destructive'>{MoneyUtils.formatMoney(total_withdraw)}</span>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{is_loading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className='h-14 w-full' />
						))}
					</div>
				)}

				{!is_loading && transactions.length === 0 && (
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

				<div className='mb-6'>
					{/* Desktop: tabela ordenável — dados tabulares combinam melhor com a largura disponível */}
					{!is_loading && transactions.length > 0 && (
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
														{renderSourceMeta(transaction_item)}
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
					)}

					{/* Mobile: cards agrupados por dia — tabela não funciona bem em tela estreita */}
					{!is_loading && groups.length > 0 && (
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
														{renderSourceMeta(transaction_item)}
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
					)}
				</div>
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
