import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';

import { useCreateWalletInvite } from '@/hooks/api/user-wallets/useCreateWalletInvite';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
}

/**
 * Diálogo de convidar alguém para a carteira ATIVA (por e-mail) — equivalente ao
 * WalletInviteFormModal do mobile, aberto a partir das Configurações. O convite é sempre para a
 * carteira ativa (`useWallet`), sem seletor, igual o mobile.
 */
const WalletInviteFormDialog = ({ open, onOpenChange }: IProps) => {
	const { toast } = useToast();
	const { user_wallet } = useWallet();
	const { mutate: createInviteMutation, isPending } = useCreateWalletInvite();

	const [ email, setEmail ] = useState('');

	useEffect(() => {
		if (open) setEmail('');
	}, [ open ]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (!user_wallet.data) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createInviteMutation({
			body: { user_email: email, wallet_id: user_wallet.data.id },
			onSuccess: () => {
				toast.success('Convite enviado!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao enviar convite')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Convite de acesso</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					{user_wallet.data && (
						<p className='text-sm text-muted-foreground'>
							Convidar alguém para a carteira <span className='font-medium text-foreground'>{user_wallet.data.name}</span>.
						</p>
					)}

					<TextInput
						type='email'
						label='E-mail'
						name='user_email'
						placeholder='email@exemplo.com'
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						disabled={isPending}
					/>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || !email}>
							Enviar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default WalletInviteFormDialog;
