import { useState } from 'react';

import { DateUtils, getApiErrorMessage, MoneyUtils, RecurrenceUtils, type TRecurrence, type TRecurrenceType } from '@myfinance/shared';
import { CreditCard, Link2, MoreVertical, Pencil, Repeat, Trash2, Wallet } from 'lucide-react';

import { useDeleteRecurrence } from '@/hooks/api/recurrences/useDeleteRecurrence';
import { useIndexRecurrences } from '@/hooks/api/recurrences/useIndexRecurrences';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import RecurrenceFormDialog from '@/components/organisms/RecurrenceFormDialog';
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

const TYPE_SEGMENTS = [
	{ value: 'recurring', label: 'Recorrentes' },
	{ value: 'installment', label: 'Parceladas' },
];

/* Valor com sinal/cor pelo tipo; transferência é neutra (não muda o saldo da carteira). */
const renderValue = (recurrence: TRecurrence) => {
	const sign = { deposit: '+', withdraw: '-', transfer: '' }[recurrence.kind];
	const color = { deposit: 'text-success', withdraw: 'text-destructive', transfer: 'text-muted-foreground' }[recurrence.kind];
	return <span className={cn('shrink-0 font-semibold', color)}>{sign}{MoneyUtils.formatMoney(recurrence.value)}</span>;
};

/*
 * Recorrências (assinaturas, salários...) e compras parceladas da carteira. Não há "nova recorrência" aqui:
 * ela nasce no formulário de transação, em "Repetir". Editar muda a regra inteira; excluir para de gerar.
 */
const RecurrenceList = () => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();
	const [ recurrence_type, setRecurrenceType ] = useState<TRecurrenceType>('recurring');
	const [ editing, setEditing ] = useState<TRecurrence | null>(null);
	const [ deleting, setDeleting ] = useState<TRecurrence | null>(null);

	const wallet_id = user_wallet.data?.id;
	const { data, isLoading } = useIndexRecurrences({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '', recurrence_type, per_page: 100 },
	});
	const { mutate: deleteRecurrenceMutation, isPending: is_delete_pending } = useDeleteRecurrence();

	const recurrences = data?.data || [];
	const is_loading = is_wallet_loading || isLoading;

	const handleConfirmDelete = () => {
		if (!deleting) return;

		deleteRecurrenceMutation({
			id: deleting.id,
			onSuccess: () => {
				toast.success('Recorrência removida');
				setDeleting(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover recorrência'));
				setDeleting(null);
			},
		});
	};

	return (
		<div className='flex flex-col gap-4'>
			<SegmentedControl segments={TYPE_SEGMENTS} value={recurrence_type} onChange={(next) => setRecurrenceType(next as TRecurrenceType)} className='self-start' />

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className='h-16 w-full' />
					))}
				</div>
			)}

			{!is_loading && recurrences.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<Repeat className='h-10 w-10 text-muted-foreground' />
					<div className='flex flex-col gap-1'>
						<span className='font-medium'>{recurrence_type === 'installment' ? 'Nenhuma compra parcelada' : 'Nenhuma recorrência'}</span>
						<span className='text-sm text-muted-foreground'>Crie uma ao lançar uma transação, em Repetir.</span>
					</div>
				</div>
			)}

			{!is_loading && recurrences.length > 0 && (
				<ul className='flex flex-col gap-2'>
					{recurrences.map((recurrence) => {
						const is_credit = recurrence.source_type === 'CreditBalance';

						return (
							<li key={recurrence.id} className='flex items-center gap-3 rounded-lg border border-card bg-card p-4'>
								<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
									<Repeat className='h-5 w-5' />
								</div>

								<div className='min-w-0 flex-1'>
									<p className='flex items-center gap-2 font-medium text-foreground'>
										<span className='truncate'>{recurrence.description}</span>
										{recurrence.origin === 'bank' && (
											<span className='inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground'>
												<Link2 className='h-3 w-3' /> do banco
											</span>
										)}
									</p>
									<p className='flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground'>
										<span>{RecurrenceUtils.ruleLabel(recurrence)}</span>
										<span>·</span>
										<span className='inline-flex items-center gap-1'>
											{is_credit ? <CreditCard className='h-3 w-3' /> : <Wallet className='h-3 w-3' />}
											{recurrence.source_name}
										</span>
										{recurrence.next_occurrence && (
											<>
												<span>·</span>
												<span>próxima {DateUtils.formateTo(recurrence.next_occurrence.transaction_date, 'dd/MM')}</span>
											</>
										)}
									</p>
								</div>

								{renderValue(recurrence)}

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button type='button' variant='ghost' size='icon' aria-label='Ações da recorrência' className='shrink-0'>
											<MoreVertical className='h-4 w-4' />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={() => setEditing(recurrence)}>
											<Pencil className='mr-2 h-4 w-4' />
											Editar
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setDeleting(recurrence)} className='text-destructive focus:text-destructive'>
											<Trash2 className='mr-2 h-4 w-4' />
											Excluir
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						);
					})}
				</ul>
			)}

			<RecurrenceFormDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} recurrence={editing} />

			<AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir recorrência</AlertDialogTitle>
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
