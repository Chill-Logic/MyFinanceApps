import { FormEvent, useEffect, useState } from 'react';

import { DateUtils, getApiErrorMessage, MoneyUtils, type TCreditBalance, type TCurrentInvoice } from '@myfinance/shared';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { usePayInvoice } from '@/hooks/api/credit-balances/usePayInvoice';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	creditBalance: TCreditBalance | null;
	/* Fatura do ciclo selecionado; ausente = fatura corrente do `creditBalance`. */
	invoice?: TCurrentInvoice | null;
	/* Data (YYYY-MM-DD) dentro do ciclo a pagar — mira a fatura exibida, não o ciclo de hoje. */
	date?: string;
}

const PayInvoiceDialog = ({ open, onOpenChange, creditBalance, invoice, date }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

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

	const active_invoice = invoice ?? creditBalance?.current_invoice ?? null;
	const invoice_amount = active_invoice?.amount ?? 0;
	const paid_amount = active_invoice?.paid_amount ?? 0;
	const remaining = active_invoice?.remaining ?? invoice_amount;

	/* Ao abrir, pré-preenche o valor com o restante (o caso mais comum: quitar de uma vez). */
	useEffect(() => {
		if (open) {
			setAccountId('');
			setValue(MoneyUtils.formatMoney(remaining));
		}
	}, [ open, remaining ]);

	const value_cents = Number(MoneyUtils.unformatMoney(value));

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!creditBalance || !account_id || value_cents <= 0) return;

		payInvoiceMutation({
			id: creditBalance.id,
			body: { account_id, value: value_cents, ...(date ? { date } : {}) },
			onSuccess: () => {
				toast.success('Pagamento registrado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível pagar a fatura')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Pagar fatura {creditBalance?.name ? `· ${ creditBalance.name }` : ''}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<div className='flex flex-col gap-2 rounded-lg border border-card bg-card px-4 py-3'>
						<div className='flex items-baseline justify-between'>
							<div className='flex flex-col'>
								<span className='text-sm text-muted-foreground'>Valor da fatura</span>
								{active_invoice?.due_date && (
									<span className='text-xs text-muted-foreground'>vence {DateUtils.formateTo(active_invoice.due_date, 'dd/MM/yyyy')}</span>
								)}
							</div>
							<span className='text-lg font-semibold'>{MoneyUtils.formatMoney(invoice_amount)}</span>
						</div>

						{paid_amount > 0 && (
							<div className='flex flex-col gap-1 border-t border-dashed border-border pt-2 text-sm'>
								<div className='flex items-center justify-between text-muted-foreground'>
									<span>Já pago</span>
									<span className='font-medium text-feedback-success-default'>{MoneyUtils.formatMoney(paid_amount)}</span>
								</div>
								<div className='flex items-center justify-between'>
									<span className='text-muted-foreground'>Restante</span>
									<span className='font-semibold text-feedback-warning-dark'>{MoneyUtils.formatMoney(remaining)}</span>
								</div>
							</div>
						)}
					</div>

					<div className='flex flex-col gap-1.5'>
						<label className='text-sm font-medium'>Pagar com a conta</label>
						{accounts.length > 0 ? (
							<Select value={account_id} onValueChange={setAccountId}>
								<SelectTrigger>
									<SelectValue placeholder='Escolha a conta pagadora' />
								</SelectTrigger>
								<SelectContent>
									{accounts.map((account) => (
										<SelectItem key={account.id} value={account.id}>
											{account.name} · {MoneyUtils.formatMoney(account.balance)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<span className='text-sm text-muted-foreground'>Você precisa de uma conta para pagar a fatura.</span>
						)}
					</div>

					<TextInput
						type='text'
						label='Valor do pagamento'
						name='value'
						placeholder='R$ 0,00'
						inputMode='numeric'
						value={value}
						onChange={(e) => setValue(MoneyUtils.formatMoney(e.target.value))}
						supportText='Pode ser parcial — o restante fica em aberto pra pagar depois.'
						disabled={isPending}
					/>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || !account_id || value_cents <= 0}>
							Pagar {MoneyUtils.formatMoney(value_cents)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default PayInvoiceDialog;
