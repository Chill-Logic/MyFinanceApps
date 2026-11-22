import { FormEvent, useEffect, useState } from 'react';

import { DateUtils, getApiErrorMessage, InvoiceUtils, MoneyUtils, type TCreditBalance, type TCurrentInvoice } from '@myfinance/shared';
import { CreditCard } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { usePayInvoice } from '@/hooks/api/credit-balances/usePayInvoice';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import DateTimeField from '@/components/molecules/DateTimeField';
import { AffixInput, Field, FIELD_INPUT, FIELD_LABEL, RadioCard, SheetDialog, SheetDialogFooter, SummaryTile } from '@/components/molecules/SheetDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	creditBalance: TCreditBalance | null;
	/* Fatura do ciclo selecionado; ausente = fatura corrente do `creditBalance`. */
	invoice?: TCurrentInvoice | null;
	/* Data (YYYY-MM-DD) dentro do ciclo a pagar — mira a fatura exibida, não o ciclo de hoje. */
	/* Mês da fatura a pagar ("YYYY-MM"). Ausente = o backend escolhe a fatura em aberto mais antiga. */
	reference?: string;
}

/* O DateTimeField tem a altura dos campos antigos (44px); aqui ele acompanha os campos da janela (52px). */
const DATE_TIME_SIZING = '[&_button]:h-[52px] [&_button]:rounded-2xl [&_input]:h-[52px] [&_input]:rounded-2xl';

/*
 * Pagar fatura (redesign 2026-11, mockup "DlgPayInvoice"): resumo da fatura (com o já pago), valor do pagamento
 * (parcial permitido), conta pagadora e "Pago em". No tablet/desktop o valor e o "Pago em" dividem a linha e a
 * conta vira cartões de rádio com o saldo; no celular a conta segue num select.
 */
const PayInvoiceDialog = ({ open, onOpenChange, creditBalance, invoice, reference }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();
	const is_desktop = useMediaQuery('(min-width: 768px)');

	const wallet_id = user_wallet.data?.id;
	const { mutate: payInvoiceMutation, isPending } = usePayInvoice();
	const { data: accounts_data } = useIndexAccounts({
		enabled: open && Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});

	const accounts = accounts_data?.data || [];
	const [ account_id, setAccountId ] = useState('');
	/* Valor do pagamento (string formatada); default = saldo restante da fatura. Permite pagamento parcial. */
	const [ value, setValue ] = useState('');
	/* Descrição do lançamento na conta pagadora (o backend usa "Fatura <crédito>" se vier vazia). */
	const [ description, setDescription ] = useState('');
	/* Quando o pagamento foi efetivado (data+hora); default = agora. Vai como `settled_date` no body. */
	const [ settled_date, setSettledDate ] = useState<Date>(new Date());

	const active_invoice = invoice ?? creditBalance?.current_invoice ?? null;
	const invoice_amount = active_invoice?.amount ?? 0;
	const paid_amount = active_invoice?.paid_amount ?? 0;
	const remaining = active_invoice?.remaining ?? invoice_amount;
	const paid_ratio = invoice_amount > 0 ? Math.min(100, (paid_amount / invoice_amount) * 100) : 100;

	const invoice_month = reference || active_invoice?.invoice_month;
	const context = [
		creditBalance?.name,
		invoice_month ? `fatura de ${ InvoiceUtils.monthLabel(invoice_month).toLowerCase() }` : null,
	].filter(Boolean).join(' · ');

	/* Ao abrir, pré-preenche o valor com o restante (o caso mais comum: quitar de uma vez). */
	useEffect(() => {
		if (open) {
			setAccountId('');
			setValue(MoneyUtils.formatMoney(remaining));
			setDescription('');
			setSettledDate(new Date());
		}
	}, [ open, remaining ]);

	const value_cents = Number(MoneyUtils.unformatMoney(value));

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!creditBalance || !account_id || value_cents <= 0) return;

		payInvoiceMutation({
			id: creditBalance.id,
			body: { account_id, value: value_cents, settled_date: settled_date.toISOString(), ...(reference ? { reference } : {}), ...(description.trim() ? { description: description.trim() } : {}) },
			onSuccess: () => {
				toast.success('Pagamento registrado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível pagar a fatura')),
		});
	};

	const account_picker = (() => {
		if (accounts.length === 0) {
			return <span className='px-1 text-sm text-muted-foreground'>Você precisa de uma conta para pagar a fatura.</span>;
		}

		if (is_desktop) {
			return (
				<div className='grid grid-cols-2 gap-2.5'>
					{accounts.map((account) => (
						<RadioCard
							key={account.id}
							checked={account.id === account_id}
							onSelect={() => setAccountId(account.id)}
							disabled={isPending}
							title={<span className='break-words'>{account.name}</span>}
							description={(
								<span className={cn(account.balance < 0 && 'text-destructive')}>{MoneyUtils.formatMoney(account.balance)}</span>
							)}
						/>
					))}
				</div>
			);
		}

		return (
			<Select value={account_id} onValueChange={setAccountId} disabled={isPending}>
				<SelectTrigger id='pay-invoice-account' className='h-[52px] rounded-2xl text-[15px]'>
					<SelectValue placeholder='Escolha a conta pagadora' />
				</SelectTrigger>
				<SelectContent>
					{accounts.map((account) => (
						<SelectItem key={account.id} value={account.id}>
							{account.name}
							<span className={cn('ml-1 text-muted-foreground', account.balance < 0 && 'text-destructive')}>· {MoneyUtils.formatMoney(account.balance)}</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	})();

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			wide
			title='Pagar fatura'
			context={context || undefined}
			contextIcon={CreditCard}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={`Pagar ${ MoneyUtils.formatMoney(value_cents) }`}
					onCancel={() => onOpenChange(false)}
					isLoading={isPending}
					disabled={!account_id || value_cents <= 0}
				/>
			)}
		>
			<SummaryTile className='gap-2.5'>
				<div className='flex items-baseline justify-between gap-3'>
					<div className='flex flex-col gap-0.5'>
						<span className='text-[13px] text-muted-foreground'>Valor da fatura</span>
						{active_invoice?.due_date && (
							<span className='text-xs text-muted-foreground'>vence {DateUtils.formateTo(active_invoice.due_date, 'dd/MM/yyyy')}</span>
						)}
					</div>
					<span className='text-xl font-semibold tracking-[-0.02em]'>{MoneyUtils.formatMoney(invoice_amount)}</span>
				</div>

				{paid_amount > 0 && (
					<>
						<span aria-hidden='true' className='flex h-1.5 overflow-hidden rounded-full bg-foreground/10'>
							<span className='rounded-full bg-success' style={{ width: `${ paid_ratio }%` }} />
						</span>
						<div className='grid grid-cols-2 gap-2.5 border-t border-dashed border-border pt-2.5'>
							<div className='flex flex-col gap-0.5'>
								<span className='text-xs text-muted-foreground'>Já pago</span>
								<span className='font-semibold text-success'>{MoneyUtils.formatMoney(paid_amount)}</span>
							</div>
							<div className='flex flex-col items-end gap-0.5'>
								<span className='text-xs text-muted-foreground'>Restante</span>
								<span className='font-semibold text-warning'>{MoneyUtils.formatMoney(remaining)}</span>
							</div>
						</div>
					</>
				)}
			</SummaryTile>

			{/* Celular: valor → conta → pago em. Tablet/desktop: valor | pago em na mesma linha, conta embaixo. */}
			<div className='grid items-start gap-4 md:grid-cols-2 md:gap-3'>
				<Field
					label='Valor do pagamento'
					htmlFor='pay-invoice-value'
					hint={value_cents > remaining && remaining > 0
						? `${ MoneyUtils.formatMoney(value_cents - remaining) } a mais que o restante desta fatura.`
						: 'Pode ser parcial — o restante fica em aberto pra pagar depois.'}
				>
					<AffixInput
						id='pay-invoice-value'
						prefix='R$'
						inputMode='numeric'
						placeholder='0,00'
						value={value.replace(/^R\$\s?/, '')}
						onChange={(e) => setValue(MoneyUtils.formatMoney(e.target.value))}
						disabled={isPending}
						className='h-16 text-[26px] font-semibold tracking-[-0.03em]'
					/>
				</Field>

				<div className='flex flex-col gap-2 md:order-last md:col-span-2' role={is_desktop && accounts.length > 0 ? 'radiogroup' : undefined} aria-label='Pagar com a conta'>
					<label htmlFor={is_desktop ? undefined : 'pay-invoice-account'} className={FIELD_LABEL}>Pagar com a conta</label>
					{account_picker}
				</div>

				<Field label='Pago em' className={DATE_TIME_SIZING}>
					<DateTimeField value={settled_date} disabled={isPending} onChange={setSettledDate} />
				</Field>
			</div>
			<Field label='Descrição no extrato da conta' htmlFor='pay-invoice-description' hint={`Opcional. Em branco fica “Fatura ${ creditBalance?.name ?? '' }”.`}>
				<input
					id='pay-invoice-description'
					className={FIELD_INPUT}
					placeholder={`Fatura ${ creditBalance?.name ?? '' }`}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					disabled={isPending}
				/>
			</Field>
		</SheetDialog>
	);
};

export default PayInvoiceDialog;
