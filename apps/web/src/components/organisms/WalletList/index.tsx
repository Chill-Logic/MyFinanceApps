import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, MoneyUtils, type TWallet } from '@myfinance/shared';
import { Check, Trash2, WalletCards } from 'lucide-react';

import { useDeleteWallet } from '@/hooks/api/wallets/useDeleteWallet';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useNavItems from '@/hooks/useNavItems';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const WalletList = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { newWalletAction } = useNavItems();
	const { current_user } = useCurrentUserContext();
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();
	const { mutate: deleteWalletMutation, isPending: is_delete_pending } = useDeleteWallet();

	const [ deleting_wallet, setDeletingWallet ] = useState<TWallet | null>(null);

	const wallets = data_wallets?.data || [];

	/*
	 * Selecionar uma carteira só troca a carteira ativa no contexto e volta pra Home (a visão da
	 * carteira selecionada) — mesmo comportamento do MyWalletsScreen do mobile.
	 */
	const handleSelect = (wallet: TWallet) => {
		setUserWallet({ data: wallet });
		navigate('/');
	};

	/*
	 * Excluir é owner-only (o backend retorna 403 caso contrário; só mostramos a ação pro dono).
	 * Se a carteira excluída for a ativa, zeramos o contexto — o WalletUserProvider volta a buscar
	 * a carteira principal sozinho.
	 */
	const handleConfirmDelete = () => {
		if (!deleting_wallet) return;

		deleteWalletMutation({
			id: deleting_wallet.id,
			onSuccess: (data) => {
				toast.success(data.message || 'Carteira removida com sucesso!');
				if (user_wallet.data?.id === deleting_wallet.id) {
					setUserWallet({ data: null });
				}
				setDeletingWallet(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover carteira'));
				setDeletingWallet(null);
			},
		});
	};

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center justify-between gap-3'>
				<Typography variant='large' className='dark:text-white'>
					Carteiras
				</Typography>

				<Button type='button' onClick={newWalletAction.onClick} className='gap-2'>
					<newWalletAction.icon className='h-4 w-4' />
					{newWalletAction.label}
				</Button>
			</div>

			{isLoading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className='h-16 w-full' />
					))}
				</div>
			)}

			{!isLoading && wallets.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<WalletCards className='h-10 w-10 text-muted-foreground' />
					<Typography className='text-muted-foreground'>Não há carteiras para mostrar</Typography>
					<Button type='button' variant='outline' onClick={newWalletAction.onClick} className='gap-2'>
						<newWalletAction.icon className='h-4 w-4' />
						{newWalletAction.label}
					</Button>
				</div>
			)}

			{!isLoading && wallets.length > 0 && (
				<ul className='flex flex-col gap-2'>
					{wallets.map((wallet) => {
						const is_active = user_wallet.data?.id === wallet.id;
						const is_owner = current_user.data?.id === wallet.owner_id;

						return (
							<li
								key={wallet.id}
								className={cn(
									'flex items-center gap-1 rounded-lg border transition-colors',
									is_active ? 'border-primary bg-accent' : 'border-border',
								)}
							>
								<button
									type='button'
									onClick={() => handleSelect(wallet)}
									className='flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-4 text-left'
								>
									<div className='min-w-0'>
										<p className='truncate font-medium text-foreground'>{wallet.name}</p>
										{Boolean(wallet.total) && (
											<p className={cn('text-sm', wallet.total >= 0 ? 'text-feedback-success-default' : 'text-feedback-danger-default')}>
												Total: {MoneyUtils.formatMoney(wallet.total)}
											</p>
										)}
									</div>
									{is_active && <Check className='h-5 w-5 shrink-0 text-primary' />}
								</button>

								{is_owner && (
									<Button
										type='button'
										variant='ghost'
										size='icon'
										aria-label='Excluir carteira'
										title='Excluir carteira'
										className='mr-2 shrink-0 text-muted-foreground hover:text-destructive'
										onClick={() => setDeletingWallet(wallet)}
									>
										<Trash2 className='h-4 w-4' />
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}

			<AlertDialog open={Boolean(deleting_wallet)} onOpenChange={(open) => !open && setDeletingWallet(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir carteira</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir a carteira "{deleting_wallet?.name}"? Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending} className='gap-2'>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default WalletList;
