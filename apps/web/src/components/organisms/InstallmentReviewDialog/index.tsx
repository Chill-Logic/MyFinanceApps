import { useState } from 'react';

import { BankConnectionUtils, DateUtils, getApiErrorMessage, MoneyUtils, type TPendingInstallmentReview } from '@myfinance/shared';
import { CheckCircle2 } from 'lucide-react';

import { useIndexPendingInstallmentReviews } from '@/hooks/api/transactions/useIndexPendingInstallmentReviews';
import { useResolveInstallmentReview } from '@/hooks/api/transactions/useResolveInstallmentReview';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Crédito cujas parcelas pendentes serão revisadas. */
	creditBalance: { id: string; name: string } | null;
}

const NEW_PURCHASE = 'new';

const suggestedGroup = (review: TPendingInstallmentReview) =>
	review.installment_candidates.find((candidate) => candidate.suggested)?.installment_group ?? review.installment_candidates[0]?.installment_group ?? NEW_PURCHASE;

const optionClass = (active: boolean) => cn(
	'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
	active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
);

const ReviewItem = ({ review }: { review: TPendingInstallmentReview }) => {
	const { toast } = useToast();
	const { mutate: resolveMutation, isPending } = useResolveInstallmentReview();
	const [ selected_group, setSelectedGroup ] = useState(() => suggestedGroup(review));

	const installment_label = BankConnectionUtils.installmentLabel(review);

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { installment_group: selected_group },
			onSuccess: () => toast.success(selected_group === NEW_PURCHASE ? 'Parcela registrada como compra nova' : 'Parcela confirmada'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao confirmar a parcela')),
		});
	};

	return (
		<li className='flex flex-col gap-3 rounded-lg border border-border p-3'>
			<div className='flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<p className='truncate font-medium text-foreground'>{review.description}</p>
					<p className='text-xs text-muted-foreground'>
						{DateUtils.formatDate(review.transaction_date)}
						{installment_label ? ` · parcela ${ installment_label }` : ''}
					</p>
				</div>
				<span className='shrink-0 font-semibold text-foreground'>{MoneyUtils.formatMoney(review.value)}</span>
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='Compra desta parcela'>
				{review.installment_candidates.map((candidate) => {
					const active = candidate.installment_group === selected_group;

					return (
						<button
							key={candidate.installment_group}
							type='button'
							role='radio'
							aria-checked={active}
							onClick={() => setSelectedGroup(candidate.installment_group)}
							className={optionClass(active)}
						>
							<span className='min-w-0 text-foreground'>
								{BankConnectionUtils.installmentCandidateLabel(candidate)}
								{candidate.suggested && <span className='ml-2 text-xs text-muted-foreground'>(sugerida)</span>}
							</span>
							<span className='shrink-0 text-xs text-muted-foreground'>
								{MoneyUtils.formatMoney(candidate.value)} · {candidate.installment_total}x
							</span>
						</button>
					);
				})}

				<button
					type='button'
					role='radio'
					aria-checked={selected_group === NEW_PURCHASE}
					onClick={() => setSelectedGroup(NEW_PURCHASE)}
					className={optionClass(selected_group === NEW_PURCHASE)}
				>
					<span className='font-medium text-foreground'>É uma compra nova</span>
				</button>
			</div>

			<Button type='button' size='sm' onClick={handleConfirm} isLoading={isPending} className='self-end'>
				Confirmar
			</Button>
		</li>
	);
};

const InstallmentReviewDialog = ({ open, onOpenChange, creditBalance }: IProps) => {
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexPendingInstallmentReviews({
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
					<DialogTitle>Parcelas para revisar {creditBalance?.name ? `· ${ creditBalance.name }` : ''}</DialogTitle>
					<DialogDescription>
						Não deu para saber a qual compra parcelada estas parcelas pertencem. Confira a sugestão e confirme.
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

export default InstallmentReviewDialog;
