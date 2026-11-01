import { useState } from 'react';

import { DateUtils, getApiErrorMessage, InvoiceUtils, MoneyUtils, type TPendingInvoiceReview } from '@myfinance/shared';
import { CheckCircle2 } from 'lucide-react';

import { useIndexPendingInvoiceReviews } from '@/hooks/api/transactions/useIndexPendingInvoiceReviews';
import { useResolveInvoiceReview } from '@/hooks/api/transactions/useResolveInvoiceReview';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Crédito cujas pendências serão revisadas. */
	creditBalance: { id: string; name: string } | null;
}

const suggestedMonth = (review: TPendingInvoiceReview) =>
	review.invoice_candidates.find((candidate) => candidate.suggested)?.invoice_month ?? review.invoice_candidates[0]?.invoice_month ?? '';

const ReviewItem = ({ review }: { review: TPendingInvoiceReview }) => {
	const { toast } = useToast();
	const { mutate: resolveMutation, isPending } = useResolveInvoiceReview();
	const [ selected_month, setSelectedMonth ] = useState(() => suggestedMonth(review));

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { invoice_month: selected_month },
			onSuccess: () => toast.success(`Pagamento confirmado na fatura de ${ InvoiceUtils.monthLabel(selected_month) }`),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao confirmar a fatura')),
		});
	};

	return (
		<li className='flex flex-col gap-3 rounded-lg border border-border p-3'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<p className='truncate font-medium text-foreground'>{review.description}</p>
					<p className='text-xs text-muted-foreground'>{DateUtils.formatDate(review.settled_date || review.transaction_date)}</p>
				</div>
				<span className='shrink-0 font-semibold text-feedback-success-default'>{MoneyUtils.formatMoney(review.value)}</span>
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='Fatura do pagamento'>
				{review.invoice_candidates.map((candidate) => {
					const active = candidate.invoice_month === selected_month;

					return (
						<button
							key={candidate.invoice_month}
							type='button'
							role='radio'
							aria-checked={active}
							onClick={() => setSelectedMonth(candidate.invoice_month)}
							className={cn(
								'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
								active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
							)}
						>
							<span className='flex min-w-0 flex-col'>
								<span className='font-medium text-foreground'>
									Fatura {InvoiceUtils.label(candidate)}
									{candidate.suggested && <span className='ml-2 text-xs font-normal text-muted-foreground'>(sugerida)</span>}
								</span>
								<span className='text-xs text-muted-foreground'>Vence {DateUtils.formatDate(candidate.due_date)}</span>
							</span>
							<span className='shrink-0 text-xs text-muted-foreground'>em aberto {MoneyUtils.formatMoney(candidate.open_amount)}</span>
						</button>
					);
				})}
			</div>

			<Button type='button' size='sm' onClick={handleConfirm} isLoading={isPending} disabled={!selected_month} className='self-end'>
				Confirmar
			</Button>
		</li>
	);
};

const InvoiceReviewDialog = ({ open, onOpenChange, creditBalance }: IProps) => {
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexPendingInvoiceReviews({
		enabled: open && Boolean(wallet_id) && Boolean(creditBalance),
		params: {
			wallet_id: wallet_id || '',
			source_type: 'CreditBalance',
			source_id: creditBalance?.id,
			per_page: 50,
		},
	});

	const reviews = data?.data || [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[85vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Faturas a confirmar {creditBalance?.name ? `· ${ creditBalance.name }` : ''}</DialogTitle>
					<DialogDescription>
						Não deu para saber de qual fatura são estes pagamentos. Confira a sugestão e confirme a fatura certa.
					</DialogDescription>
				</DialogHeader>

				{isLoading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 2 }).map((_, index) => (
							<Skeleton key={index} className='h-32 w-full' />
						))}
					</div>
				)}

				{!isLoading && reviews.length === 0 && (
					<div className='flex flex-col items-center gap-2 py-8 text-center'>
						<CheckCircle2 className='h-10 w-10 text-feedback-success-default' />
						<span className='font-medium'>Nenhuma pendência</span>
					</div>
				)}

				{!isLoading && reviews.length > 0 && (
					<ul className='flex flex-col gap-3'>
						{reviews.map((review) => (
							<ReviewItem key={review.id} review={review} />
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default InvoiceReviewDialog;
