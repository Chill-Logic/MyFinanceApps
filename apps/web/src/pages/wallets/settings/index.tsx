import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';
import { UserPlus } from 'lucide-react';

import { useUpdateWallet } from '@/hooks/api/wallets/useUpdateWallet';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import Typography from '@/components/atoms/Typography';
import WalletInviteFormDialog from '@/components/organisms/WalletInviteFormDialog';

/**
 * Configurações da carteira ATIVA — equivalente à WalletsSettingsScreen do mobile: renomear a
 * carteira ativa (useUpdateWallet, inline) + botão "Convidar" que abre o WalletInviteFormDialog.
 * Não há gestão de membros/sair/excluir — isso não existe nem no mobile nem na API.
 */
const WalletsSettingsPage = () => {
	const { toast } = useToast();
	const { user_wallet, setUserWallet } = useWallet();
	const { mutate: updateWalletMutation, isPending } = useUpdateWallet();

	const [ name, setName ] = useState('');
	const [ is_invite_open, setIsInviteOpen ] = useState(false);

	const active_wallet = user_wallet.data;

	useEffect(() => {
		if (active_wallet) setName(active_wallet.name);
	}, [ active_wallet ]);

	if (!active_wallet) {
		return (
			<div className='flex flex-col gap-4'>
				<Typography variant='large' className='dark:text-white'>
					Configurações
				</Typography>
				<Typography className='text-muted-foreground'>
					Selecione uma carteira para configurar.
				</Typography>
			</div>
		);
	}

	const is_submit_disabled = isPending || active_wallet.name === name || !name;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		updateWalletMutation({
			id: active_wallet.id,
			body: { name },
			onSuccess: (wallet) => {
				toast.success('Carteira atualizada!');
				setUserWallet({ data: wallet });
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar carteira')),
		});
	};

	return (
		<div className='flex flex-col gap-6'>
			<Typography variant='large' className='dark:text-white'>
				Configurações
			</Typography>

			<form onSubmit={handleSubmit} className='flex max-w-md flex-col gap-4'>
				<TextInput
					type='text'
					label='Nome da carteira'
					name='name'
					placeholder='Digite o nome da carteira'
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={isPending}
				/>

				<div className='flex flex-col gap-2 sm:flex-row'>
					<Button type='button' variant='outline' className='gap-2' onClick={() => setIsInviteOpen(true)}>
						<UserPlus className='h-4 w-4' />
						Convidar
					</Button>
					<Button type='submit' isLoading={isPending} disabled={is_submit_disabled}>
						Salvar
					</Button>
				</div>
			</form>

			<WalletInviteFormDialog open={is_invite_open} onOpenChange={setIsInviteOpen} />
		</div>
	);
};

export default WalletsSettingsPage;
