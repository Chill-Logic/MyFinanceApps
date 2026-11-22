import { useState } from 'react';

import { DateUtils, getApiErrorMessage, InvoiceUtils, MoneyUtils, type TPendingInvoiceReview } from '@myfinance/shared';
import { CheckCircle2, CreditCard } from 'lucide-react';

import { useIndexPendingInvoiceReviews } from '@/hooks/api/transactions/useIndexPendingInvoiceReviews';
import { useResolveInvoiceReview } from '@/hooks/api/transactions/useResolveInvoiceReview';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { GLASS_TILE } from '@/components/molecules/NavKit';
import { RadioCard, SheetDialog } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';
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
		<li className={cn('flex flex-col gap-3 rounded-[22px] p-3.5', GLASS_TILE)}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex min-w-0 flex-col gap-0.5'>
					<span className='text-xs text-muted-foreground'>Pagamento</span>
					<p className='truncate text-[15px] font-semibold'>{review.description}</p>
					<p className='text-xs text-muted-foreground'>pago em {DateUtils.formatDate(review.settled_date || review.transaction_date)}</p>
				</div>
				<span className='shrink-0 text-[17px] font-semibold text-success'>{MoneyUtils.formatMoney(review.value)}</span>
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='Fatura do pagamento'>
				<span className='text-xs text-muted-foreground'>Abate da fatura de…</span>
				{review.invoice_candidates.map((candidate) => (
					<RadioCard
						key={candidate.invoice_month}
						checked={candidate.invoice_month === selected_month}
						onSelect={() => setSelectedMonth(candidate.invoice_month)}
						disabled={isPending}
						title={InvoiceUtils.label(candidate)}
						badge={candidate.suggested ? <Badge variant='brand'>sugerida</Badge> : undefined}
						/*
						 * No celular o "em aberto" desce pra segunda linha: à direita ele roubava a largura do título e o
						 * selo "sugerida" quebrava de linha mesmo com título curto.
						 */
						description={(
							<>
								vence {DateUtils.formatDate(candidate.due_date)}
								<span className='md:hidden'> · em aberto {MoneyUtils.formatMoney(candidate.open_amount)}</span>
							</>
						)}
						trailing={(
							<span className='flex flex-col items-end gap-0.5 max-md:hidden'>
								{MoneyUtils.formatMoney(candidate.open_amount)}
								<span className='text-xs font-normal text-muted-foreground'>em aberto</span>
							</span>
						)}
					/>
				))}
			</div>

			<Button type='button' onClick={handleConfirm} isLoading={isPending} disabled={!selected_month} className='h-10 self-end px-5 font-bold'>
				Confirmar
			</Button>
		</li>
	);
};

/* Faturas a confirmar (redesign 2026-11, mockup "DlgInvoiceReview"). Cada pagamento se confirma sozinho. */
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
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			wide
			title='Faturas a confirmar'
			context={creditBalance?.name}
			contextIcon={CreditCard}
			description='Não deu para saber de qual fatura são estes pagamentos. Confira a sugestão e confirme a fatura certa.'
		>
			{isLoading && (
				<div className='flex flex-col gap-3 pb-3'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-40 w-full rounded-[22px]' />
					))}
				</div>
			)}

			{!isLoading && reviews.length === 0 && (
				<div className='flex flex-col items-center gap-2 py-10 text-center'>
					<CheckCircle2 className='size-10 text-success' />
					<span className='font-medium'>Nenhuma pendência</span>
				</div>
			)}

			{!isLoading && reviews.length > 0 && (
				<ul className='flex flex-col gap-3 pb-3'>
					{reviews.map((review) => (
						<ReviewItem key={review.id} review={review} />
					))}
				</ul>
			)}
		</SheetDialog>
	);
};

export default InvoiceReviewDialog;
