import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TCreditBalance } from '@myfinance/shared';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { usePayInvoice } from '@/hooks/api/credit-balances/usePayInvoice';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	creditBalance: TCreditBalance | null;
}

const PayInvoiceDialog = ({ open, onOpenChange, creditBalance }: IProps) => {
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

	useEffect(() => {
		if (open) setAccountId('');
	}, [ open ]);

	const invoice_amount = creditBalance?.current_invoice.amount ?? 0;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!creditBalance || !account_id) return;

		payInvoiceMutation({
			id: creditBalance.id,
			body: { account_id },
			onSuccess: () => {
				toast.success('Fatura paga!');
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
					<div className='flex items-baseline justify-between rounded-lg border border-card bg-card px-4 py-3'>
						<span className='text-sm text-muted-foreground'>Valor da fatura</span>
						<span className='text-lg font-semibold'>{MoneyUtils.formatMoney(invoice_amount)}</span>
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

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || !account_id || invoice_amount <= 0}>
							Pagar {MoneyUtils.formatMoney(invoice_amount)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default PayInvoiceDialog;
