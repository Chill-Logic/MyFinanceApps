import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TAccount, type TAccountKind } from '@myfinance/shared';
import { Wallet } from 'lucide-react';

import { useCreateAccount } from '@/hooks/api/accounts/useCreateAccount';
import { useUpdateAccount } from '@/hooks/api/accounts/useUpdateAccount';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import SegmentedControl from '@/components/molecules/SegmentedControl';
import { AffixInput, Field, FIELD_INPUT, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	account?: TAccount | null;
}

const ACCOUNT_KINDS = [
	{ value: 'checking', label: 'Conta corrente' },
	{ value: 'savings', label: 'Poupança' },
	{ value: 'cash', label: 'Dinheiro' },
];

/* Nova/editar conta (redesign 2026-11, mockup "DlgAccount"). Tipo em abas; saldo inicial só na criação. */
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
		} else {
			setName('');
			setKind('checking');
			setInitialBalance('');
		}
	}, [ open, account ]);

	const is_pending = is_create_pending || is_update_pending;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		/* Update só mexe em nome/tipo. O saldo inicial existe só na criação (vira uma transação no backend). */
		if (account) {
			updateAccountMutation({
				id: account.id,
				body: { name, kind },
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
			body: { name, kind, initial_balance: Number(MoneyUtils.unformatMoney(initial_balance)) },
			onSuccess: () => {
				toast.success('Conta criada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar conta')),
		});
	};

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title={account ? 'Editar conta' : 'Nova conta'}
			context={user_wallet.data ? `Na carteira ${ user_wallet.data.name }` : undefined}
			contextIcon={Wallet}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={account ? 'Salvar' : 'Criar conta'}
					onCancel={() => onOpenChange(false)}
					isLoading={is_pending}
					disabled={!name.trim()}
				/>
			)}
		>
			<Field label='Tipo'>
				<SegmentedControl segments={ACCOUNT_KINDS} value={kind} onChange={(value) => setKind(value as TAccountKind)} />
			</Field>

			<div className='grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
				<Field label='Nome' htmlFor='account-name' className={account ? 'md:col-span-2' : undefined}>
					<input
						id='account-name'
						className={FIELD_INPUT}
						placeholder='Ex.: Nubank, Carteira'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>
				</Field>

				{/* Saldo inicial só na criação — no backend vira uma transação "Saldo inicial" efetivada */}
				{!account && (
					<Field label='Saldo inicial' htmlFor='account-balance'>
						<AffixInput
							id='account-balance'
							prefix='R$'
							inputMode='numeric'
							placeholder='0,00'
							value={initial_balance.replace(/^R\$\s?/, '')}
							onChange={(e) => setInitialBalance(MoneyUtils.formatMoney(e.target.value))}
							disabled={is_pending}
						/>
					</Field>
				)}
			</div>

			<p className='px-1 text-xs text-muted-foreground'>
				{account
					? 'O saldo muda pelas transações. O saldo inicial vira um lançamento “Saldo inicial” no começo da conta.'
					: 'O saldo inicial entra como um lançamento “Saldo inicial” já efetivado. Pode deixar zero.'}
			</p>
		</SheetDialog>
	);
};

export default AccountFormDialog;
