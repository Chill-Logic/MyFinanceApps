import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TWallet } from '@myfinance/shared';

import { useCreateWallet } from '@/hooks/api/wallets/useCreateWallet';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	onSuccess?: (wallet: TWallet)=> void;
}

/**
 * Diálogo de criar carteira — equivalente ao WalletFormModal (modo criação) do mobile. Renomear
 * fica na página de Configurações (usa `useUpdateWallet` inline), igual o mobile faz na
 * WalletsSettingsScreen; por isso aqui é só criação.
 */
const WalletFormDialog = ({ open, onOpenChange, onSuccess }: IProps) => {
	const { toast } = useToast();
	const { mutate: createWalletMutation, isPending } = useCreateWallet();

	const [ name, setName ] = useState('');

	useEffect(() => {
		if (open) setName('');
	}, [ open ]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		createWalletMutation({
			body: { name },
			onSuccess: (wallet) => {
				toast.success('Carteira criada!');
				onOpenChange(false);
				onSuccess?.(wallet);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar carteira')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nova carteira</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Digite o nome da carteira'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={isPending}
					/>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || !name}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default WalletFormDialog;
