import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TCreditBalance } from '@myfinance/shared';

import { useCreateCreditBalance } from '@/hooks/api/credit-balances/useCreateCreditBalance';
import { useUpdateCreditBalance } from '@/hooks/api/credit-balances/useUpdateCreditBalance';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	creditBalance?: TCreditBalance | null;
}

/* Mantém o dígito entre 1 e 31 (dias de fechamento/vencimento). */
const clampDay = (value: string): string => {
	const digits = value.replace(/\D/g, '').slice(0, 2);
	if (!digits) return '';
	return String(Math.min(31, Math.max(1, Number(digits))));
};

const CreditBalanceFormDialog = ({ open, onOpenChange, creditBalance }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const { mutate: createMutation, isPending: is_create_pending } = useCreateCreditBalance();
	const { mutate: updateMutation, isPending: is_update_pending } = useUpdateCreditBalance();

	const [ name, setName ] = useState('');
	const [ credit_limit, setCreditLimit ] = useState('');
	const [ closing_day, setClosingDay ] = useState('');
	const [ due_day, setDueDay ] = useState('');

	useEffect(() => {
		if (!open) return;

		if (creditBalance) {
			setName(creditBalance.name);
			setCreditLimit(MoneyUtils.formatMoney(creditBalance.credit_limit));
			setClosingDay(String(creditBalance.closing_day));
			setDueDay(String(creditBalance.due_day));
		} else {
			setName('');
			setCreditLimit('');
			setClosingDay('');
			setDueDay('');
		}
	}, [ open, creditBalance ]);

	const is_pending = is_create_pending || is_update_pending;
	const is_disabled = is_pending || !name || !credit_limit || !closing_day || !due_day;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const body = {
			name,
			credit_limit: Number(MoneyUtils.unformatMoney(credit_limit)),
			closing_day: Number(closing_day),
			due_day: Number(due_day),
		};

		if (creditBalance) {
			updateMutation({
				id: creditBalance.id,
				body,
				onSuccess: () => {
					toast.success('Crédito atualizado!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar crédito')),
			});
			return;
		}

		if (!user_wallet.data) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createMutation({
			wallet_id: user_wallet.data.id,
			body,
			onSuccess: () => {
				toast.success('Crédito criado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar crédito')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{creditBalance ? 'Editar crédito' : 'Novo crédito'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Ex.: Nubank, Inter'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>

					<TextInput
						type='text'
						label='Limite'
						name='credit_limit'
						placeholder='R$ 0,00'
						value={credit_limit}
						onChange={(e) => setCreditLimit(MoneyUtils.formatMoney(e.target.value))}
						disabled={is_pending}
					/>

					<div className='flex gap-4'>
						<TextInput
							type='text'
							label='Dia de fechamento'
							name='closing_day'
							placeholder='1 a 31'
							value={closing_day}
							onChange={(e) => setClosingDay(clampDay(e.target.value))}
							disabled={is_pending}
							className='flex-1'
						/>
						<TextInput
							type='text'
							label='Dia de vencimento'
							name='due_day'
							placeholder='1 a 31'
							value={due_day}
							onChange={(e) => setDueDay(clampDay(e.target.value))}
							disabled={is_pending}
							className='flex-1'
						/>
					</div>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={is_pending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={is_pending} disabled={is_disabled}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default CreditBalanceFormDialog;
