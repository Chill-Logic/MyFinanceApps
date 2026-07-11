import { useState } from 'react';

import { getApiErrorMessage, type TInvite } from '@myfinance/shared';
import { Check, Mail, X } from 'lucide-react';

import { useAcceptWalletInvite } from '@/hooks/api/user-wallets/useAcceptWalletInvite';
import { useListInvites } from '@/hooks/api/user-wallets/useListInvites';
import { useRejectWalletInvite } from '@/hooks/api/user-wallets/useRejectWalletInvite';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import { Skeleton } from '@/components/ui/skeleton';

type TProcessing = {
	id: string;
	action: 'accept' | 'reject';
};

const InvitesList = () => {
	const { toast } = useToast();
	const { data: data_invites, isLoading } = useListInvites();
	const { mutate: acceptInviteMutation } = useAcceptWalletInvite();
	const { mutate: rejectInviteMutation } = useRejectWalletInvite();

	const [ processing, setProcessing ] = useState<TProcessing | null>(null);

	const invites = data_invites?.data || [];

	const handleAccept = (invite: TInvite) => {
		setProcessing({ id: invite.id, action: 'accept' });
		acceptInviteMutation({
			id: invite.id,
			onSuccess: () => {
				toast.success('Convite aceito com sucesso');
				setProcessing(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao aceitar convite'));
				setProcessing(null);
			},
		});
	};

	const handleReject = (invite: TInvite) => {
		setProcessing({ id: invite.id, action: 'reject' });
		rejectInviteMutation({
			id: invite.id,
			onSuccess: () => {
				toast.success('Convite rejeitado com sucesso');
				setProcessing(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao rejeitar convite'));
				setProcessing(null);
			},
		});
	};

	return (
		<div className='flex flex-col gap-4'>
			<Typography variant='large' className='dark:text-white'>
				Convites
			</Typography>

			{isLoading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className='h-20 w-full' />
					))}
				</div>
			)}

			{!isLoading && invites.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<Mail className='h-10 w-10 text-muted-foreground' />
					<Typography className='text-muted-foreground'>Não há convites para mostrar</Typography>
				</div>
			)}

			{!isLoading && invites.length > 0 && (
				<ul className='flex flex-col gap-2'>
					{invites.map((invite) => {
						const is_processing_row = processing?.id === invite.id;

						return (
							<li
								key={invite.id}
								className='flex items-center justify-between gap-3 rounded-lg border border-card bg-card p-4'
							>
								<div className='min-w-0'>
									<p className='truncate font-medium text-foreground'>{invite.owner_name}</p>
									<p className='truncate text-sm text-muted-foreground'>Carteira: {invite.wallet_name}</p>
								</div>

								<div className='flex shrink-0 gap-2'>
									<Button
										type='button'
										size='icon'
										variant='default'
										aria-label='Aceitar convite'
										title='Aceitar'
										isLoading={is_processing_row && processing?.action === 'accept'}
										disabled={is_processing_row}
										onClick={() => handleAccept(invite)}
									>
										{!(is_processing_row && processing?.action === 'accept') && <Check className='h-4 w-4' />}
									</Button>

									<Button
										type='button'
										size='icon'
										variant='destructive'
										aria-label='Rejeitar convite'
										title='Rejeitar'
										isLoading={is_processing_row && processing?.action === 'reject'}
										disabled={is_processing_row}
										onClick={() => handleReject(invite)}
									>
										{!(is_processing_row && processing?.action === 'reject') && <X className='h-4 w-4' />}
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default InvitesList;
