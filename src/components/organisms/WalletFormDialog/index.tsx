import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TWallet } from '@myfinance/shared';
import { Users } from 'lucide-react';

import { useCreateWallet } from '@/hooks/api/wallets/useCreateWallet';
import { useUpdateWallet } from '@/hooks/api/wallets/useUpdateWallet';
import useToast from '@/hooks/useToast';

import { walletInitials } from '@/components/molecules/NavKit';
import { Field, FIELD_INPUT, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Presente → modo edição (renomear); ausente → modo criação. */
	wallet?: TWallet | null;
	onSuccess?: (wallet: TWallet)=> void;
}

/**
 * Diálogo de criar OU renomear carteira (redesign 2026-11, mockup "DlgWallet"). Sem `wallet` cria
 * (useCreateWallet); com `wallet` renomeia (useUpdateWallet). A criação é montada globalmente no
 * DefaultTemplate (via newWalletDialog); a edição é montada localmente na WalletList (menu ⋮ de cada carteira).
 * O avatar ao lado do nome mostra as iniciais conforme a pessoa digita.
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
		if (!name) return;

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
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title={wallet ? 'Editar carteira' : 'Nova carteira'}
			description='Cada carteira tem as próprias contas, cartões e transações.'
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={wallet ? 'Salvar carteira' : 'Criar carteira'}
					onCancel={() => onOpenChange(false)}
					isLoading={is_pending}
					disabled={!name}
				/>
			)}
		>
			<div className='flex items-end gap-3'>
				<span aria-hidden='true' className='size-[52px] shrink-0 rounded-full bg-gradient-to-br from-[#C8DBA4] to-[#12708A] p-0.5'>
					<span className='flex size-full items-center justify-center rounded-full bg-[#E7E3DD] text-base font-bold text-foreground dark:bg-[#0E2A3A]'>
						{walletInitials(name)}
					</span>
				</span>
				<Field label='Nome' htmlFor='wallet-name' className='flex-1'>
					<input
						id='wallet-name'
						name='name'
						className={FIELD_INPUT}
						placeholder='Digite o nome da carteira'
						value={name}
						onChange={(e) => setName(e.target.value)}
						disabled={is_pending}
					/>
				</Field>
			</div>

			{!wallet && (
				<p className='flex items-start gap-2 px-1 text-[13px] leading-snug text-muted-foreground'>
					<Users className='mt-0.5 size-3.5 shrink-0' />
					<span>Você administra esta carteira. Depois de criar, dá para convidar alguém pelo menu ⋮ dela.</span>
				</p>
			)}
		</SheetDialog>
	);
};

export default WalletFormDialog;
