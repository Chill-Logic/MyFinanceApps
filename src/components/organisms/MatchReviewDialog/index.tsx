import { useState } from 'react';

import { BankConnectionUtils, DateUtils, getApiErrorMessage, MoneyUtils, type TMatchCandidate, type TPendingMatchReview, type TTransactionSourceType } from '@myfinance/shared';
import { CheckCircle2, CreditCard, Landmark } from 'lucide-react';

import { useIndexPendingMatches } from '@/hooks/api/transactions/useIndexPendingMatches';
import { useResolveMatch } from '@/hooks/api/transactions/useResolveMatch';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { GLASS_TILE } from '@/components/molecules/NavKit';
import { RadioCard, SheetDialog } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export type TMatchReviewSource = { type: TTransactionSourceType; id: string; name: string };

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Conta ou cartão cujas pendências de conciliação serão revisadas. */
	source: TMatchReviewSource | null;
}

const NONE = 'none';

/* Mesmos nomes do resto do app (o `translated_kind` da API diz Saque/Depósito). */
const KIND_LABEL: Record<string, string> = { withdraw: 'Saída', deposit: 'Entrada', transfer: 'Transferência' };

const suggestedCandidate = (review: TPendingMatchReview) =>
	review.match_candidates.find((candidate) => candidate.suggested)?.id ?? review.match_candidates[0]?.id ?? NONE;

/*
 * O rótulo do shared é "descrição · data · origem" numa linha só; aqui a descrição vira o título e o resto a
 * segunda linha (o texto continua vindo do helper, pra não divergir dele).
 */
const candidateDetail = (candidate: TMatchCandidate) => {
	const label = BankConnectionUtils.matchCandidateLabel(candidate);
	const prefix = `${ candidate.description } · `;
	return label.startsWith(prefix) ? label.slice(prefix.length) : undefined;
};

const ReviewItem = ({ review }: { review: TPendingMatchReview }) => {
	const { toast } = useToast();
	const { mutate: resolveMutation, isPending } = useResolveMatch();
	const [ selected, setSelected ] = useState(() => suggestedCandidate(review));

	const installment_label = BankConnectionUtils.installmentLabel(review);
	const is_installment = Boolean(review.installment_total);

	const handleConfirm = () => {
		resolveMutation({
			id: review.id,
			body: { candidate_id: selected },
			onSuccess: () => toast.success(selected === NONE ? 'Mantida como transação nova' : 'Transações juntadas'),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao conferir a transação')),
		});
	};

	return (
		<li className={cn('flex flex-col gap-3 rounded-[22px] p-3.5', GLASS_TILE)}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex min-w-0 flex-col gap-0.5'>
					<span className='text-xs text-muted-foreground'>Do banco</span>
					<p className='truncate font-mono text-sm font-medium'>{review.description}</p>
					<p className='text-xs text-muted-foreground'>
						{DateUtils.formatDate(review.transaction_date)}
						{` · ${ KIND_LABEL[review.kind] ?? review.translated_kind }`}
						{installment_label ? ` · parcela ${ installment_label }` : ''}
					</p>
				</div>
				<span className='shrink-0 text-[17px] font-semibold'>{MoneyUtils.formatMoney(review.value)}</span>
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='O que é esta transação'>
				<span className='text-xs text-muted-foreground'>É a mesma que…</span>
				{review.match_candidates.map((candidate) => (
					<RadioCard
						key={candidate.id}
						checked={candidate.id === selected}
						onSelect={() => setSelected(candidate.id)}
						disabled={isPending}
						title={candidate.description}
						badge={candidate.suggested ? <Badge variant='brand'>sugerida</Badge> : undefined}
						description={candidateDetail(candidate)}
						trailing={(
							<span className='flex flex-col items-end gap-0.5'>
								{MoneyUtils.formatMoney(candidate.value)}
								{candidate.installment_total ? <span className='text-xs font-normal text-muted-foreground'>{candidate.installment_total}x</span> : null}
							</span>
						)}
					/>
				))}

				<RadioCard
					checked={selected === NONE}
					onSelect={() => setSelected(NONE)}
					disabled={isPending}
					title={is_installment ? 'É uma compra nova' : 'É outra transação'}
					description={is_installment ? undefined : 'Manter as duas'}
				/>
			</div>

			<Button type='button' onClick={handleConfirm} isLoading={isPending} className='h-10 self-end px-5 font-bold'>
				Confirmar
			</Button>
		</li>
	);
};

/* Conciliação com o banco (redesign 2026-11, mockup "DlgMatchReview"). Cada pendência se confirma sozinha. */
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
	const pending_count = data?.total_count ?? reviews.length;

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			wide
			title='Para conferir'
			contextIcon={source?.type === 'CreditBalance' ? CreditCard : Landmark}
			context={source?.name ? (
				<span className='inline-flex items-center gap-1.5'>
					{source.name}
					{pending_count > 0 && <Badge variant='warning'>{pending_count} para conferir</Badge>}
				</span>
			) : undefined}
			description='O banco trouxe transações parecidas com algo que já estava lançado. Diga se é a mesma coisa para não duplicar.'
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

export default MatchReviewDialog;
