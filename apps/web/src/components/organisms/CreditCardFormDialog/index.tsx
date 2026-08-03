import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TCreditCard } from '@myfinance/shared';

import { useCreateCreditCard } from '@/hooks/api/credit-cards/useCreateCreditCard';
import { useUpdateCreditCard } from '@/hooks/api/credit-cards/useUpdateCreditCard';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Obrigatório na criação (a qual limite/fatura o cartão pertence). */
	creditBalanceId?: string;
	card?: TCreditCard | null;
}

const CreditCardFormDialog = ({ open, onOpenChange, creditBalanceId, card }: IProps) => {
	const { toast } = useToast();

	const { mutate: createMutation, isPending: is_create_pending } = useCreateCreditCard();
	const { mutate: updateMutation, isPending: is_update_pending } = useUpdateCreditCard();

	const [ name, setName ] = useState('');
	const [ last_digits, setLastDigits ] = useState('');

	useEffect(() => {
		if (!open) return;

		if (card) {
			setName(card.name);
			setLastDigits(card.last_digits || '');
		} else {
			setName('');
			setLastDigits('');
		}
	}, [ open, card ]);

	const is_pending = is_create_pending || is_update_pending;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const body = { name, last_digits: last_digits || undefined };

		if (card) {
			updateMutation({
				id: card.id,
				body,
				onSuccess: () => {
					toast.success('Cartão atualizado!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar cartão')),
			});
			return;
		}

		if (!creditBalanceId) {
			toast.error('Crédito não identificado');
			return;
		}

		createMutation({
			credit_balance_id: creditBalanceId,
			body,
			onSuccess: () => {
				toast.success('Cartão criado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar cartão')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{card ? 'Editar cartão' : 'Novo cartão'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Ex.: Físico, Virtual, Adicional'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>

					<TextInput
						type='text'
						label='Últimos dígitos (opcional)'
						name='last_digits'
						placeholder='Ex.: 1234'
						value={last_digits}
						onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
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

export default CreditCardFormDialog;
