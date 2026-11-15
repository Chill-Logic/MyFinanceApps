import { useState } from 'react';

import { BankConnectionUtils, DateUtils, getApiErrorMessage, MoneyUtils, type TPendingMatchReview, type TTransactionSourceType } from '@myfinance/shared';
import { CheckCircle2 } from 'lucide-react';

import { useIndexPendingMatches } from '@/hooks/api/transactions/useIndexPendingMatches';
import { useResolveMatch } from '@/hooks/api/transactions/useResolveMatch';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export type TMatchReviewSource = { type: TTransactionSourceType; id: string; name: string };

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Conta ou cartão cujas pendências de conciliação serão revisadas. */
	source: TMatchReviewSource | null;
}

const NONE = 'none';

const suggestedCandidate = (review: TPendingMatchReview) =>
	review.match_candidates.find((candidate) => candidate.suggested)?.id ?? review.match_candidates[0]?.id ?? NONE;

const optionClass = (active: boolean) => cn(
	'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
	active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
);

const ReviewItem = ({ review }: { review: TPendingMatchReview }) => {
	const { toast } = useToast();
	const { mutate: resolveMutation, isPending } = useResolveMatch();
	const [ selected, setSelected ] = useState(() => suggestedCandidate(review));

	const installment_label = BankConnectionUtils.installmentLabel(review);
	const none_label = review.installment_total ? 'É uma compra nova' : 'É outra transação (manter as duas)';

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { candidate_id: selected },
			onSuccess: () => toast.success(selected === NONE ? 'Mantida como transação nova' : 'Transações juntadas'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao conferir a transação')),
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

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='O que é esta transação'>
				{review.match_candidates.map((candidate) => {
					const active = candidate.id === selected;

					return (
						<button
							key={candidate.id}
							type='button'
							role='radio'
							aria-checked={active}
							onClick={() => setSelected(candidate.id)}
							className={optionClass(active)}
						>
							<span className='min-w-0 text-foreground'>
								{BankConnectionUtils.matchCandidateLabel(candidate)}
								{candidate.suggested && <span className='ml-2 text-xs text-muted-foreground'>(sugerida)</span>}
							</span>
							<span className='shrink-0 text-xs text-muted-foreground'>
								{MoneyUtils.formatMoney(candidate.value)}
								{candidate.installment_total ? ` · ${ candidate.installment_total }x` : ''}
							</span>
						</button>
					);
				})}

				<button
					type='button'
					role='radio'
					aria-checked={selected === NONE}
					onClick={() => setSelected(NONE)}
					className={optionClass(selected === NONE)}
				>
					<span className='font-medium text-foreground'>{none_label}</span>
				</button>
			</div>

			<Button type='button' size='sm' onClick={handleConfirm} isLoading={isPending} className='self-end'>
				Confirmar
			</Button>
		</li>
	);
};

const MatchReviewDialog = ({ open, onOpenChange, source }: IProps) => {
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;

	const { data, isLoading } = useIndexPendingMatches({
		enabled: open && Boolean(wallet_id) && Boolean(source),
		params: {
			wallet_id: wallet_id || '',
			source_type: source?.type,
			source_id: source?.id,
			per_page: 50,
		},
	});

	const reviews = data?.data || [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[85vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Para conferir {source?.name ? `· ${ source.name }` : ''}</DialogTitle>
					<DialogDescription>
						O banco trouxe transações parecidas com algo que já estava lançado. Diga se é a mesma coisa para não duplicar.
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

export default MatchReviewDialog;
