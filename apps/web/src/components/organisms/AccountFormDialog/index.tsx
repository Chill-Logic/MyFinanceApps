import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TAccount, type TAccountKind } from '@myfinance/shared';

import { useCreateAccount } from '@/hooks/api/accounts/useCreateAccount';
import { useUpdateAccount } from '@/hooks/api/accounts/useUpdateAccount';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	account?: TAccount | null;
}

const ACCOUNT_KINDS: { value: TAccountKind; label: string }[] = [
	{ value: 'checking', label: 'Conta corrente' },
	{ value: 'savings', label: 'Poupança' },
	{ value: 'cash', label: 'Dinheiro' },
];

const AccountFormDialog = ({ open, onOpenChange, account }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const { mutate: createAccountMutation, isPending: is_create_pending } = useCreateAccount();
	const { mutate: updateAccountMutation, isPending: is_update_pending } = useUpdateAccount();

	const [ name, setName ] = useState('');
	const [ kind, setKind ] = useState<TAccountKind>('checking');
	const [ initial_balance, setInitialBalance ] = useState('');

	useEffect(() => {
		if (!open) return;

		if (account) {
			setName(account.name);
			setKind(account.kind);
			setInitialBalance(MoneyUtils.formatMoney(account.initial_balance));
		} else {
			setName('');
			setKind('checking');
			setInitialBalance('');
		}
	}, [ open, account ]);

	const is_pending = is_create_pending || is_update_pending;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const body = {
			name,
			kind,
			initial_balance: Number(MoneyUtils.unformatMoney(initial_balance)),
		};

		if (account) {
			updateAccountMutation({
				id: account.id,
				body,
				onSuccess: () => {
					toast.success('Conta atualizada!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar conta')),
			});
			return;
		}

		if (!user_wallet.data) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createAccountMutation({
			wallet_id: user_wallet.data.id,
			body,
			onSuccess: () => {
				toast.success('Conta criada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar conta')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{account ? 'Editar conta' : 'Nova conta'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Ex.: Conta Corrente, Carteira'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>

					<div className='flex flex-col gap-1.5'>
						<label className='text-sm font-medium'>Tipo</label>
						<Select value={kind} onValueChange={(value) => setKind(value as TAccountKind)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ACCOUNT_KINDS.map((option) => (
									<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<TextInput
						type='text'
						label='Saldo inicial'
						name='initial_balance'
						placeholder='R$ 0,00'
						value={initial_balance}
						onChange={(e) => setInitialBalance(MoneyUtils.formatMoney(e.target.value))}
						disabled={is_pending}
					/>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={is_pending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={is_pending} disabled={is_pending || !name}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default AccountFormDialog;
