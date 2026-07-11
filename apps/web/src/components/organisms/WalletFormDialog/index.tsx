import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TWallet } from '@myfinance/shared';

import { useCreateWallet } from '@/hooks/api/wallets/useCreateWallet';
import { useUpdateWallet } from '@/hooks/api/wallets/useUpdateWallet';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Presente → modo edição (renomear); ausente → modo criação. */
	wallet?: TWallet | null;
	onSuccess?: (wallet: TWallet)=> void;
}

/**
 * Diálogo de criar OU renomear carteira. Sem `wallet` cria (useCreateWallet); com `wallet` renomeia
 * (useUpdateWallet). A criação é montada globalmente no DefaultTemplate (via newWalletDialog); a
 * edição é montada localmente na WalletList (menu de ações ⋮ de cada carteira).
 */
const WalletFormDialog = ({ open, onOpenChange, wallet, onSuccess }: IProps) => {
	const { toast } = useToast();
	const { mutate: createWalletMutation, isPending: is_create_pending } = useCreateWallet();
	const { mutate: updateWalletMutation, isPending: is_update_pending } = useUpdateWallet();

	const [ name, setName ] = useState('');

	useEffect(() => {
		if (open) setName(wallet?.name ?? '');
	}, [ open, wallet ]);

	const is_pending = is_create_pending || is_update_pending;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (wallet) {
			updateWalletMutation({
				id: wallet.id,
				body: { name },
				onSuccess: (updated) => {
					toast.success('Carteira atualizada!');
					onOpenChange(false);
					onSuccess?.(updated);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar carteira')),
			});
			return;
		}

		createWalletMutation({
			body: { name },
			onSuccess: (created) => {
				toast.success('Carteira criada!');
				onOpenChange(false);
				onSuccess?.(created);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar carteira')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{wallet ? 'Editar carteira' : 'Nova carteira'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Nome'
						name='name'
						placeholder='Digite o nome da carteira'
						value={name}
						onChange={(e) => setName(e.target.value)}
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

export default WalletFormDialog;
