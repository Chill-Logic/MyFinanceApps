import { FormEvent, useEffect, useState } from 'react';

import { DateUtils, getApiErrorMessage, MoneyUtils, TransactionUtils, type TTransaction } from '@myfinance/shared';
import { ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarIcon, Copy, CreditCard, Lock, Wallet, X } from 'lucide-react';

import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import DateTimeField from '@/components/molecules/DateTimeField';
import { GLASS_TILE } from '@/components/molecules/NavKit';
import { Field, FIELD_INPUT, FIELD_LABEL, SheetDialog, SheetDialogFooter, SummaryTile } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';

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
 * Visual: redesign 2026-11, mockup "DlgDuplicate" (resumo do que é copiado + campos; datas lado a lado do md pra cima).
 */
const TransactionDuplicateDialog = ({ open, onOpenChange, transaction, sourceName }: IProps) => {
	const { toast } = useToast();
	const { mutate: createTransactionMutation, isPending: is_pending } = useCreateTransactions();
	const { data: members, isLoading: is_members_loading } = useListWalletMembers({ enabled: open, wallet_id: transaction?.wallet_id });

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
		if (is_transfer) return { badge: 'bg-info-soft text-info', value: 'text-foreground', sign: '', label: 'Transferência', Icon: ArrowLeftRight };
		if (is_deposit) return { badge: 'bg-success-soft text-success', value: 'text-success', sign: '+', label: 'Entrada', Icon: ArrowUpRight };
		return { badge: 'bg-danger-soft text-danger', value: 'text-destructive', sign: '−', label: 'Saída', Icon: ArrowDownRight };
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

	const is_submit_disabled = is_pending || is_members_loading || (!is_transfer && !description.trim());

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!transaction || is_submit_disabled) return;

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
				/* Mantém o autor original; se ele saiu da carteira, ausente = o backend usa o usuário logado. */
				user_id: members?.some((member) => member.id === transaction.user_id) ? transaction.user_id : undefined,
			},
			onSuccess: () => {
				toast.success('Transação duplicada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao duplicar transação')),
		});
	};

	/* Atalho do mockup: empurra a data da transação mais um mês (mantém o horário). */
	const addOneMonth = () => setTransactionDate((current) => DateUtils.addMonths(current, 1) ?? current);

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title='Duplicar transação'
			description='Cria uma nova com o mesmo valor, tipo e conta.'
			wide
			onSubmit={transaction ? handleSubmit : undefined}
			footer={transaction && (
				<SheetDialogFooter
					submitLabel={(
						<>
							<Copy className='size-4' />
							Duplicar
						</>
					)}
					onCancel={() => onOpenChange(false)}
					isLoading={is_pending}
					disabled={is_submit_disabled}
				/>
			)}
		>
			{transaction && (
				<>
					{/* Resumo do que é copiado da original (não editável) */}
					<SummaryTile className='flex-row items-center gap-3 px-3.5 py-3'>
						<span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', kind_style.badge)}>
							<kind_style.Icon className='size-[18px]' />
						</span>
						<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
							<span className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
								{is_credit ? <CreditCard className='size-3.5 shrink-0' /> : <Wallet className='size-3.5 shrink-0' />}
								<span className='truncate'>
									{sourceName || (is_credit ? 'Crédito' : 'Conta')}
								</span>
								{is_transfer && (
									<>
										<ArrowRight className='size-3.5 shrink-0' />
										<span className='truncate'>{transaction.destination_account_name || 'Conta'}</span>
									</>
								)}
								<span className='shrink-0'>· {kind_style.label}</span>
								{transaction.draft && <Badge className='shrink-0'>Rascunho</Badge>}
							</span>
							<span className={cn('text-lg font-semibold tracking-[-0.02em]', kind_style.value)}>
								{kind_style.sign}{MoneyUtils.formatMoney(transaction.value)}
							</span>
						</span>
						<span className='inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground'>
							<Lock className='size-3' />
							copiado
						</span>
					</SummaryTile>

					<Field label={is_transfer ? 'Descrição (opcional)' : 'Descrição'} htmlFor='duplicate-description'>
						<input
							id='duplicate-description'
							name='description'
							className={FIELD_INPUT}
							placeholder={is_transfer ? default_transfer_description : 'Digite a descrição'}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={is_pending}
						/>
					</Field>

					{/* Uma embaixo da outra: lado a lado a coluna ficava estreita e a hora caía pra baixo da data. */}
					<div className='grid gap-4'>
						<div className='flex min-w-0 flex-col gap-2'>
							<div className='flex items-center justify-between gap-2'>
								<span className={FIELD_LABEL}>Data da transação</span>
								<button
									type='button'
									onClick={addOneMonth}
									disabled={is_pending}
									className={cn('pressable rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50', GLASS_TILE)}
								>
									+1 mês
								</button>
							</div>
							<DateTimeField value={transaction_date} disabled={is_pending} onChange={setTransactionDate} />
						</div>

						{/* "Pago em" só aparece em conta — crédito é efetivado automaticamente pelo backend */}
						{!is_credit && (
							<div className='flex min-w-0 flex-col gap-2'>
								<span className={FIELD_LABEL}>
									Pago em <span className='opacity-75'>— vazio = pendente</span>
								</span>
								{settled_date ? (
									<div className='flex items-start gap-2'>
										<div className='min-w-0 flex-1'>
											<DateTimeField value={settled_date} disabled={is_pending} onChange={setSettledDate} />
										</div>
										<button
											type='button'
											disabled={is_pending}
											aria-label='Marcar como pendente'
											title='Marcar como pendente'
											onClick={() => setSettledDate(null)}
											className={cn('pressable flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50', GLASS_TILE)}
										>
											<X className='size-4' />
										</button>
									</div>
								) : (
									<button
										type='button'
										disabled={is_pending}
										onClick={() => setSettledDate(new Date(transaction_date))}
										className='pressable flex h-[52px] w-full items-center gap-2 rounded-2xl border border-dashed border-foreground/25 px-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
									>
										<CalendarIcon className='size-4' />
										Marcar como pago
									</button>
								)}
							</div>
						)}
					</div>
				</>
			)}
		</SheetDialog>
	);
};

export default TransactionDuplicateDialog;
