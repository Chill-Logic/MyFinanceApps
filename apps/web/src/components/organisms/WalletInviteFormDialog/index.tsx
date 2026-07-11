import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TWallet } from '@myfinance/shared';

import { useCreateWalletInvite } from '@/hooks/api/user-wallets/useCreateWalletInvite';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Carteira alvo do convite. Se ausente, usa a carteira ativa (`useWallet`). */
	wallet?: TWallet | null;
}

/**
 * Diálogo de convidar alguém (por e-mail) para uma carteira. Aberto pelo menu de ações (⋮) de cada
 * carteira, convidando pra AQUELA carteira (mais preciso que "a ativa"); mantém fallback pra ativa.
 */
const WalletInviteFormDialog = ({ open, onOpenChange, wallet }: IProps) => {
	const { toast } = useToast();
	const { user_wallet } = useWallet();
	const { mutate: createInviteMutation, isPending } = useCreateWalletInvite();

	const [ email, setEmail ] = useState('');

	const target_wallet = wallet ?? user_wallet.data;

	useEffect(() => {
		if (open) setEmail('');
	}, [ open ]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (!target_wallet) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createInviteMutation({
			body: { user_email: email, wallet_id: target_wallet.id },
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
					{target_wallet && (
						<p className='text-sm text-muted-foreground'>
							Convidar alguém para a carteira <span className='font-medium text-foreground'>{target_wallet.name}</span>.
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
