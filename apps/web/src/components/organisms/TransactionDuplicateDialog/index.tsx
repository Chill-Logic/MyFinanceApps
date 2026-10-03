import { FormEvent, useEffect, useState } from 'react';

import { DateUtils, getApiErrorMessage, MoneyUtils, TransactionUtils, type TTransaction } from '@myfinance/shared';
import { ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarIcon, CreditCard, Wallet, X } from 'lucide-react';

import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import DateTimeField from '@/components/molecules/DateTimeField';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FIELD_METRICS } from '@/components/ui/field';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* A transação de referência: tudo (valor, tipo, origem, cartão, rascunho) é copiado dela. */
	transaction: TTransaction | null;
	/* Nome da origem (conta/cartão) só pra exibir no resumo — a origem em si nunca muda ao duplicar. */
	sourceName?: string;
}

/*
 * Duplicar = criar uma transação NOVA copiando tudo da original (valor, tipo, origem, cartão, rascunho),
 * deixando editável só a descrição e a data da transação — pensado pra cobranças recorrentes. Em conta, o
 * "Pago em" também é editável (opcional, mesma condicional do form normal) e começa vazio: a cópia nasce
 * pendente por padrão. Em crédito não há "Pago em" (o backend auto-efetiva).
 */
const TransactionDuplicateDialog = ({ open, onOpenChange, transaction, sourceName }: IProps) => {
	const { toast } = useToast();
	const { mutate: createTransactionMutation, isPending: is_pending } = useCreateTransactions();

	const [ description, setDescription ] = useState('');
	const [ transaction_date, setTransactionDate ] = useState<Date>(new Date());
	const [ settled_date, setSettledDate ] = useState<Date | null>(null);

	const is_credit = transaction?.source_type === 'CreditBalance';
	const is_deposit = transaction?.kind === 'deposit';
	/* Transferência copia o destino junto; no resumo fica neutra (o sinal dependeria de quem olha). */
	const is_transfer = transaction?.kind === 'transfer';
	const default_transfer_description = is_transfer
		? TransactionUtils.transferDescription(transaction?.source_name || sourceName, transaction?.destination_account_name)
		: '';
	const kind_style = (() => {
		if (is_transfer) return { badge: 'bg-feedback-info-light text-feedback-info-default', value: 'text-foreground', sign: '', Icon: ArrowLeftRight };
		if (is_deposit) return { badge: 'bg-feedback-success-light text-feedback-success-dark', value: 'text-feedback-success-default', sign: '+', Icon: ArrowUpRight };
		return { badge: 'bg-feedback-danger-light text-feedback-danger-dark', value: 'text-destructive', sign: '-', Icon: ArrowDownRight };
	})();

	useEffect(() => {
		if (!open || !transaction) return;

		setDescription(transaction.description);
		/*
		 * Default +1 mês e mesmo dia da original (pensado pra cobrança recorrente do mês seguinte), mas com o
		 * HORÁRIO DE AGORA: a cópia é um lançamento novo, e herdar o horário da original faria uma transação
		 * antiga de 00:00 nascer 00:00 de novo.
		 */
		setTransactionDate(DateUtils.withCurrentTime(DateUtils.addMonths(transaction.transaction_date, 1) ?? transaction.transaction_date));
		setSettledDate(null); // cópia nasce pendente; o usuário marca como pago se quiser
	}, [ open, transaction ]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!transaction) return;

		const account_settled_date = settled_date ? settled_date.toISOString() : undefined;

		createTransactionMutation({
			body: {
				/* Em transferência pode ir em branco: o backend gera "Transferência <origem> -> <destino>". */
				description: description.trim(),
				value: transaction.value,
				kind: transaction.kind,
				transaction_date: transaction_date.toISOString(),
				/* Crédito é auto-efetivado pelo backend — não enviamos o campo (seria sobrescrito). */
				settled_date: is_credit ? undefined : account_settled_date,
				source_type: transaction.source_type,
				source_id: transaction.source_id,
				credit_card_id: is_credit ? (transaction.credit_card_id || undefined) : undefined,
				destination_account_id: is_transfer ? (transaction.destination_account_id || undefined) : undefined,
				draft: transaction.draft,
			},
			onSuccess: () => {
				toast.success('Transação duplicada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao duplicar transação')),
		});
	};

	const is_submit_disabled = is_pending || (!is_transfer && !description.trim());

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Duplicar transação</DialogTitle>
				</DialogHeader>

				{transaction && (
					<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
						{/* Resumo do que é copiado da original (não editável) */}
						<div className='flex items-center gap-3 rounded-lg border border-card bg-card px-4 py-3'>
							<div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', kind_style.badge)}>
								<kind_style.Icon className='h-4 w-4' />
							</div>
							<div className='flex flex-1 flex-col overflow-hidden'>
								<span className='inline-flex items-center gap-1.5 truncate text-xs text-muted-foreground'>
									{is_credit ? <CreditCard className='h-3.5 w-3.5' /> : <Wallet className='h-3.5 w-3.5' />}
									{sourceName || (is_credit ? 'Crédito' : 'Conta')}
									{is_transfer && (
										<>
											<ArrowRight className='h-3.5 w-3.5' />
											{transaction.destination_account_name || 'Conta'}
										</>
									)}
									{transaction.draft && <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase'>Rascunho</span>}
								</span>
								<span className={cn('text-base font-semibold', kind_style.value)}>
									{kind_style.sign}{MoneyUtils.formatMoney(transaction.value)}
								</span>
							</div>
						</div>

						<TextInput
							type='text'
							label={is_transfer ? 'Descrição (opcional)' : 'Descrição'}
							name='description'
							placeholder={is_transfer ? default_transfer_description : 'Digite a descrição'}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={is_pending}
						/>

						<div className='flex flex-col gap-1.5'>
							<label className='text-sm font-medium'>Data da transação</label>
							<DateTimeField value={transaction_date} disabled={is_pending} onChange={setTransactionDate} />
						</div>

						{/* "Pago em" só aparece em conta — crédito é efetivado automaticamente pelo backend */}
						{!is_credit && (
							<div className='flex flex-col gap-1.5'>
								<label className='text-sm font-medium'>
									Pago em <span className='font-normal text-muted-foreground'>— vazio = pendente</span>
								</label>
								{settled_date ? (
									<div className='flex items-center gap-2'>
										<div className='flex-1'>
											<DateTimeField value={settled_date} disabled={is_pending} onChange={setSettledDate} />
										</div>
										<Button
											type='button'
											variant='ghost'
											size='icon'
											disabled={is_pending}
											aria-label='Marcar como pendente'
											onClick={() => setSettledDate(null)}
										>
											<X className='h-4 w-4' />
										</Button>
									</div>
								) : (
									<Button
										type='button'
										variant='outline'
										disabled={is_pending}
										className={`${ FIELD_METRICS } justify-start gap-2 text-muted-foreground`}
										onClick={() => setSettledDate(new Date(transaction_date))}
									>
										<CalendarIcon className='h-4 w-4' />
										Marcar como pago
									</Button>
								)}
							</div>
						)}

						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={is_pending}>
								Cancelar
							</Button>
							<Button type='submit' isLoading={is_pending} disabled={is_submit_disabled}>
								Duplicar
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default TransactionDuplicateDialog;
