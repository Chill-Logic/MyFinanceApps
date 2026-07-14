import { useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TCreditBalance, type TCreditCard } from '@myfinance/shared';
import { AlertTriangle, CreditCard as CreditCardIcon, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import { useDeleteCreditBalance } from '@/hooks/api/credit-balances/useDeleteCreditBalance';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteCreditCard } from '@/hooks/api/credit-cards/useDeleteCreditCard';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import CreditBalanceFormDialog from '@/components/organisms/CreditBalanceFormDialog';
import CreditCardFormDialog from '@/components/organisms/CreditCardFormDialog';
import PayInvoiceDialog from '@/components/organisms/PayInvoiceDialog';
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

/* "2026-09-10" → "10/09" sem passar por Date (evita deslocamento de fuso). */
const formatDueDate = (iso: string): string => {
	const [ , month, day ] = iso.split('-');
	return day && month ? `${ day }/${ month }` : iso;
};

interface ICreditBalanceCardProps {
	creditBalance: TCreditBalance;
}

const CreditBalanceCard = ({ creditBalance }: ICreditBalanceCardProps) => {
	const { toast } = useToast();

	const { data: cards_data, isLoading: is_cards_loading } = useIndexCreditCards({
		params: { credit_balance_id: creditBalance.id },
	});
	const { mutate: deleteBalanceMutation, isPending: is_delete_balance_pending } = useDeleteCreditBalance();
	const { mutate: deleteCardMutation, isPending: is_delete_card_pending } = useDeleteCreditCard();

	const [ is_edit_open, setIsEditOpen ] = useState(false);
	const [ is_delete_open, setIsDeleteOpen ] = useState(false);
	const [ is_pay_open, setIsPayOpen ] = useState(false);
	const [ is_card_create_open, setIsCardCreateOpen ] = useState(false);
	const [ editing_card, setEditingCard ] = useState<TCreditCard | null>(null);
	const [ deleting_card, setDeletingCard ] = useState<TCreditCard | null>(null);

	const cards = cards_data?.data || [];
	const invoice = creditBalance.current_invoice;
	const limit = creditBalance.credit_limit || 0;
	const used_pct = limit > 0 ? Math.min(100, Math.max(0, (creditBalance.used / limit) * 100)) : 0;
	const can_pay = !invoice.paid && invoice.amount > 0;

	const handleDeleteBalance = () => {
		deleteBalanceMutation({
			id: creditBalance.id,
			onSuccess: () => {
				toast.success('Crédito removido com sucesso');
				setIsDeleteOpen(false);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover crédito'));
				setIsDeleteOpen(false);
			},
		});
	};

	const handleDeleteCard = () => {
		if (!deleting_card) return;

		deleteCardMutation({
			id: deleting_card.id,
			onSuccess: () => {
				toast.success('Cartão removido com sucesso');
				setDeletingCard(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover cartão'));
				setDeletingCard(null);
			},
		});
	};

	return (
		<div className='flex flex-col gap-4 rounded-xl border border-card bg-card p-4'>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex items-center gap-3'>
					<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
						<CreditCardIcon className='h-5 w-5' />
					</div>
					<div>
						<p className='font-semibold text-foreground'>{creditBalance.name}</p>
						<p className='text-xs text-muted-foreground'>
							{cards.length} cartã{cards.length === 1 ? 'o' : 'os'}
						</p>
					</div>
				</div>

				<div className='flex items-center gap-2'>
					<div className='text-right'>
						<p className='text-[11px] uppercase tracking-wide text-muted-foreground'>Limite</p>
						<p className='font-medium'>{MoneyUtils.formatMoney(limit)}</p>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type='button' variant='ghost' size='icon' aria-label='Ações do crédito' className='shrink-0'>
								<MoreVertical className='h-4 w-4' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={() => setIsEditOpen(true)}>
								<Pencil className='mr-2 h-4 w-4' />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className='text-destructive focus:text-destructive'>
								<Trash2 className='mr-2 h-4 w-4' />
								Excluir
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div>
				<div className='h-2 overflow-hidden rounded-full bg-muted'>
					<div className='h-full rounded-full bg-primary' style={{ width: `${ used_pct }%` }} />
				</div>
				<div className='mt-1.5 flex justify-between text-xs text-muted-foreground'>
					<span>usado <span className='font-medium text-foreground'>{MoneyUtils.formatMoney(creditBalance.used)}</span></span>
					<span>disponível <span className='font-medium text-foreground'>{MoneyUtils.formatMoney(creditBalance.available)}</span></span>
				</div>
			</div>

			<div className='flex items-center justify-between gap-3 border-t border-dashed border-border pt-3'>
				<div>
					<p className='text-[11px] uppercase tracking-wide text-muted-foreground'>Fatura atual</p>
					<p className='text-lg font-semibold'>{MoneyUtils.formatMoney(invoice.amount)}</p>
					<p className={cn('text-xs font-medium', invoice.paid ? 'text-feedback-success-default' : 'text-feedback-warning-dark')}>
						{invoice.paid ? 'Paga' : `vence ${ formatDueDate(invoice.due_date) }`}
					</p>
				</div>
				<Button type='button' onClick={() => setIsPayOpen(true)} disabled={!can_pay}>
					{invoice.paid ? 'Fatura paga' : 'Pagar fatura'}
				</Button>
			</div>

			<div className='flex flex-col gap-2 border-t border-border pt-3'>
				{!is_cards_loading && cards.length === 0 && (
					<div className='flex items-start gap-2 rounded-lg bg-feedback-warning-light px-3 py-2 text-xs text-feedback-warning-dark'>
						<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
						<span>Cadastre um cartão para lançar compras neste crédito — sem cartão, ele não aparece como origem nas transações.</span>
					</div>
				)}

				{is_cards_loading ? (
					<Skeleton className='h-9 w-full' />
				) : (
					cards.map((card) => (
						<div key={card.id} className='flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2'>
							<CreditCardIcon className='h-4 w-4 text-muted-foreground' />
							<span className='flex-1 text-sm'>
								{card.name}{card.last_digits ? <span className='text-muted-foreground'> ·· {card.last_digits}</span> : null}
							</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button type='button' variant='ghost' size='icon' aria-label='Ações do cartão' className='h-7 w-7 shrink-0'>
										<MoreVertical className='h-4 w-4' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									<DropdownMenuItem onClick={() => setEditingCard(card)}>
										<Pencil className='mr-2 h-4 w-4' />
										Editar
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setDeletingCard(card)} className='text-destructive focus:text-destructive'>
										<Trash2 className='mr-2 h-4 w-4' />
										Excluir
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					))
				)}

				<Button type='button' variant='outline' onClick={() => setIsCardCreateOpen(true)} className='gap-2'>
					<Plus className='h-4 w-4' />
					Adicionar cartão
				</Button>
			</div>

			<CreditBalanceFormDialog open={is_edit_open} onOpenChange={setIsEditOpen} creditBalance={creditBalance} />
			<PayInvoiceDialog open={is_pay_open} onOpenChange={setIsPayOpen} creditBalance={creditBalance} />
			<CreditCardFormDialog open={is_card_create_open} onOpenChange={setIsCardCreateOpen} creditBalanceId={creditBalance.id} />
			<CreditCardFormDialog
				open={Boolean(editing_card)}
				onOpenChange={(open) => !open && setEditingCard(null)}
				card={editing_card}
			/>

			<AlertDialog open={is_delete_open} onOpenChange={setIsDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir crédito</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir "{creditBalance.name}"? Os cartões e transações vinculados também serão removidos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_balance_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteBalance} disabled={is_delete_balance_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={Boolean(deleting_card)} onOpenChange={(open) => !open && setDeletingCard(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir cartão</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir o cartão "{deleting_card?.name}"?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_card_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteCard} disabled={is_delete_card_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

const CreditBalanceList = () => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();

	const wallet_id = user_wallet.data?.id;
	const { data: credit_balances_data, isLoading: is_credit_loading } = useIndexCreditBalances({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});

	const [ is_create_open, setIsCreateOpen ] = useState(false);

	const credit_balances = credit_balances_data?.data || [];
	const is_loading = is_wallet_loading || is_credit_loading;

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center justify-between gap-3'>
				<span className='text-sm text-muted-foreground'>Limite, fatura e cartões de cada crédito</span>
				<Button type='button' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id} className='gap-2'>
					<Plus className='h-4 w-4' />
					Novo crédito
				</Button>
			</div>

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-48 w-full' />
					))}
				</div>
			)}

			{!is_loading && credit_balances.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<CreditCardIcon className='h-10 w-10 text-muted-foreground' />
					<div className='flex flex-col gap-1'>
						<span className='font-medium'>Nenhum crédito ainda</span>
						<span className='text-sm text-muted-foreground'>Cadastre um cartão de crédito com limite e datas de fechamento/vencimento.</span>
					</div>
					<Button type='button' variant='secondary' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id} className='gap-2'>
						<Plus className='h-4 w-4' />
						Criar crédito
					</Button>
				</div>
			)}

			{!is_loading && credit_balances.length > 0 && (
				<div className='flex flex-col gap-3'>
					{credit_balances.map((credit_balance) => (
						<CreditBalanceCard key={credit_balance.id} creditBalance={credit_balance} />
					))}
				</div>
			)}

			<CreditBalanceFormDialog open={is_create_open} onOpenChange={setIsCreateOpen} />
		</div>
	);
};

export default CreditBalanceList;
