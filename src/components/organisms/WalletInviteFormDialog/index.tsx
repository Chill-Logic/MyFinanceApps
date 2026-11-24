import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, type TWallet } from '@myfinance/shared';
import { Info, Mail } from 'lucide-react';

import { useCreateWalletInvite } from '@/hooks/api/user-wallets/useCreateWalletInvite';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import { walletInitials } from '@/components/molecules/NavKit';
import { Field, FIELD_INPUT, SheetDialog, SheetDialogFooter, SummaryTile } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/** Carteira alvo do convite. Se ausente, usa a carteira ativa (`useWallet`). */
	wallet?: TWallet | null;
}

/**
 * Diálogo de convidar alguém (por e-mail) para uma carteira (redesign 2026-11, mockup "DlgInvite"). Aberto
 * pelo menu de ações (⋮) de cada carteira, convidando pra AQUELA carteira (mais preciso que "a ativa");
 * mantém fallback pra ativa.
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
		if (!email) return;

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
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title='Convite de acesso'
			description='Convide alguém por e-mail para ver e lançar nesta carteira.'
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel='Enviar convite'
					onCancel={() => onOpenChange(false)}
					isLoading={isPending}
					disabled={!email}
				/>
			)}
		>
			{target_wallet && (
				<SummaryTile className='flex-row items-center gap-3 px-3.5 py-3'>
					<span aria-hidden='true' className='size-10 shrink-0 rounded-full bg-gradient-to-br from-[#C8DBA4] to-[#12708A] p-0.5'>
						<span className='flex size-full items-center justify-center rounded-full bg-[#E7E3DD] text-[13px] font-bold text-foreground dark:bg-[#0E2A3A]'>
							{walletInitials(target_wallet.name)}
						</span>
					</span>
					<span className='min-w-0 flex-1 truncate text-[15px] font-semibold'>{target_wallet.name}</span>
					<Badge variant='brand'>carteira</Badge>
				</SummaryTile>
			)}

			<Field label='E-mail' htmlFor='invite-email'>
				{/* Ícone de e-mail dentro do campo (o `prefix` do AffixInput só aceita texto, por causa do atributo nativo). */}
				<div className='relative'>
					<Mail aria-hidden='true' className='pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
					<input
						id='invite-email'
						type='email'
						name='user_email'
						className={cn(FIELD_INPUT, 'pl-11')}
						placeholder='email@exemplo.com'
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						disabled={isPending}
					/>
				</div>
			</Field>

			<p className='flex items-start gap-2 px-1 text-[13px] leading-snug text-muted-foreground'>
				<Info className='mt-0.5 size-3.5 shrink-0' />
				<span>A pessoa vê o convite em Convites e escolhe aceitar ou recusar. Precisa ter conta no MyFinance com esse e-mail.</span>
			</p>
		</SheetDialog>
	);
};

export default WalletInviteFormDialog;
