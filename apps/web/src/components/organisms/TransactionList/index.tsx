import { useState } from 'react';

import { DateUtils, MoneyUtils, type TTransaction } from '@myfinance/shared';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, MoreVertical, Plus, Receipt } from 'lucide-react';

import { useDeleteTransactions } from '@/hooks/api/transactions/useDeleteTransactions';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import useToast from '@/hooks/useToast';

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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

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

const TransactionList = () => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();
	const { is_open: is_new_transaction_open, setIsOpen: setIsNewTransactionOpen } = useNewTransactionDialog();

	const [ month_year, setMonthYear ] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
	const [ editing_transaction, setEditingTransaction ] = useState<TTransaction | null>(null);
	const [ deleting_transaction, setDeletingTransaction ] = useState<TTransaction | null>(null);

	const { start_date, end_date } = DateUtils.getMonthRange(month_year.year, month_year.month);

	const { data: data_transactions, isLoading: is_loading } = useListTransactions({
		params: {
			wallet_id: user_wallet.data?.id || '',
			start_date,
			end_date,
		},
	});

	const { mutate: deleteTransactionMutation, isPending: is_delete_pending } = useDeleteTransactions();

	const transactions = data_transactions?.transactions || [];
	const groups = groupTransactionsByDay(transactions);

	const total_deposit = transactions.filter((item) => item.kind === 'deposit').reduce((acc, item) => acc + item.value, 0);
	const total_withdraw = transactions.filter((item) => item.kind === 'withdraw').reduce((acc, item) => acc + item.value, 0);
	const total = Number(data_transactions?.total ?? 0);

	const changeMonth = (offset: number) => {
		const date = new Date(month_year.year, month_year.month + offset, 1);
		setMonthYear({ month: date.getMonth(), year: date.getFullYear() });
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
			onError: () => toast.error('Não foi possível excluir a transação'),
		});
	};

	return (
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
					disabled={!user_wallet.data?.id}
					className='hidden gap-2 md:inline-flex'
				>
					<Plus className='h-4 w-4' />
					Nova Transação
				</Button>
			</div>

			<div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3'>
				<div className='flex flex-col'>
					<span className='text-xs font-medium uppercase text-muted-foreground'>Saldo</span>
					{is_loading ? (
						<Skeleton className='h-5 w-20' />
					) : (
						<span className={cn('text-base font-semibold', total >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
							{MoneyUtils.formatMoney(total)}
						</span>
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

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 6 }).map((_, index) => (
						<Skeleton key={index} className='h-14 w-full' />
					))}
				</div>
			)}

			{!is_loading && groups.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center'>
					<Receipt className='h-10 w-10 text-muted-foreground' />
					<div className='flex flex-col gap-1'>
						<span className='font-medium'>Nenhuma transação neste mês</span>
						<span className='text-sm text-muted-foreground'>Registre uma entrada ou saída pra começar</span>
					</div>
					<Button type='button' variant='secondary' onClick={() => setIsNewTransactionOpen(true)} disabled={!user_wallet.data?.id} className='gap-2'>
						<Plus className='h-4 w-4' />
						Adicionar transação
					</Button>
				</div>
			)}

			{!is_loading && groups.length > 0 && (
				<div className='flex flex-col gap-4'>
					{groups.map((group) => (
						<div key={group.label} className='flex flex-col gap-2'>
							<span className='text-xs font-medium uppercase text-muted-foreground'>{group.label}</span>

							<div className='flex flex-col gap-2'>
								{group.items.map((transaction_item) => {
									const is_deposit = transaction_item.kind === 'deposit';

									return (
										<div
											key={transaction_item.id}
											className='flex items-center gap-3 rounded-xl border border-border bg-card p-3'
										>
											<div
												className={cn(
													'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
													is_deposit ? 'bg-feedback-success-light text-feedback-success-dark' : 'bg-feedback-danger-light text-feedback-danger-dark',
												)}
											>
												{is_deposit ? <ArrowUpRight className='h-4 w-4' /> : <ArrowDownRight className='h-4 w-4' />}
											</div>

											<div className='flex flex-1 flex-col overflow-hidden'>
												<span className='truncate text-sm font-medium'>{transaction_item.description}</span>
												{transaction_item.user?.name && (
													<span className='truncate text-xs text-muted-foreground'>{transaction_item.user.name}</span>
												)}
											</div>

											<span className={cn('text-sm font-semibold', is_deposit ? 'text-feedback-success-default' : 'text-destructive')}>
												{is_deposit ? '+' : '-'}{MoneyUtils.formatMoney(transaction_item.value)}
											</span>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button type='button' variant='ghost' size='icon' aria-label='Ações da transação'>
														<MoreVertical className='h-4 w-4' />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align='end'>
													<DropdownMenuItem onClick={() => setEditingTransaction(transaction_item)}>
														Editar
													</DropdownMenuItem>
													<DropdownMenuItem className='text-destructive' onClick={() => setDeletingTransaction(transaction_item)}>
														Excluir
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}

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
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending}>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default TransactionList;
