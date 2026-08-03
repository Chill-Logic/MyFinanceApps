import { useState } from 'react';

import { getApiErrorMessage, MoneyUtils, QUERY_KEYS, type TWallet } from '@myfinance/shared';
import { Check, MoreVertical, Pencil, Star, Trash2, UserPlus, WalletCards } from 'lucide-react';

import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import { useDeleteWallet } from '@/hooks/api/wallets/useDeleteWallet';
import { useGetMainWallet } from '@/hooks/api/wallets/useGetMainWallet';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useNavItems from '@/hooks/useNavItems';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import WalletFormDialog from '@/components/organisms/WalletFormDialog';
import WalletInviteFormDialog from '@/components/organisms/WalletInviteFormDialog';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const WalletList = () => {
	const { toast } = useToast();
	const { newWalletAction } = useNavItems();
	const { current_user } = useCurrentUserContext();
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();
	const { mutate: deleteWalletMutation, isPending: is_delete_pending } = useDeleteWallet();

	const { data: main_wallet } = useGetMainWallet({
		enabled: Boolean(current_user.data?.id),
		params: { user_id: current_user.data?.id || '' },
	});
	const { mutate: updateCurrentUserMutation } = useUpdateCurrentUser();

	const [ editing_wallet, setEditingWallet ] = useState<TWallet | null>(null);
	const [ inviting_wallet, setInvitingWallet ] = useState<TWallet | null>(null);
	const [ deleting_wallet, setDeletingWallet ] = useState<TWallet | null>(null);
	const [ setting_main_id, setSettingMainId ] = useState<string | null>(null);

	const wallets = data_wallets?.data || [];

	/*
	 * Editar/Convidar/Excluir são owner-only (o backend retorna 403 caso contrário) — só aparecem pro
	 * dono. Ao excluir a carteira ativa, zeramos o contexto pra o WalletUserProvider rebuscar a principal.
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

	/*
	 * Definir carteira principal (PATCH /users/me com main_wallet_id) — vale pra qualquer carteira
	 * acessível/aceita, não só as próprias. Invalida a query da carteira principal pra o badge atualizar
	 * (o hook de update do usuário só invalida o /users/me por conta própria).
	 */
	const handleSetMain = (wallet: TWallet) => {
		setSettingMainId(wallet.id);
		updateCurrentUserMutation({
			body: { main_wallet_id: wallet.id },
			onSuccess: () => {
				toast.success(`"${ wallet.name }" agora é sua carteira principal`);
				queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
				setSettingMainId(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao definir carteira principal'));
				setSettingMainId(null);
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
						const is_main = main_wallet?.id === wallet.id;

						return (
							<li
								key={wallet.id}
								className={cn(
									'flex items-center gap-3 rounded-lg border bg-card p-4',
									is_active ? 'border-primary' : 'border-card',
								)}
							>
								<div className='min-w-0 flex-1'>
									<div className='flex items-center gap-2'>
										<p className='truncate font-medium text-foreground'>{wallet.name}</p>
										{is_main && (
											<span className='flex shrink-0 items-center gap-1 rounded-full bg-brand-secondary/15 px-2 py-0.5 text-xs font-semibold text-brand-secondary'>
												<Star className='h-3 w-3 fill-current' />
												Principal
											</span>
										)}
									</div>
									{Boolean(wallet.total) && (
										<p className={cn('text-sm', wallet.total >= 0 ? 'text-feedback-success-default' : 'text-feedback-danger-default')}>
											Total: {MoneyUtils.formatMoney(wallet.total)}
										</p>
									)}
								</div>

								{is_active && (
									<span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground' title='Carteira que você está visualizando'>
										<Check className='h-3 w-3' />
									</span>
								)}

								{(is_owner || !is_main) && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												type='button'
												variant='ghost'
												size='icon'
												aria-label='Ações da carteira'
												className='shrink-0'
											>
												<MoreVertical className='h-4 w-4' />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align='end'>
											{!is_main && (
												<DropdownMenuItem onClick={() => handleSetMain(wallet)} disabled={setting_main_id === wallet.id}>
													<Star className='mr-2 h-4 w-4' />
													Definir como principal
												</DropdownMenuItem>
											)}

											{!is_main && is_owner && <DropdownMenuSeparator />}

											{is_owner && (
												<>
													<DropdownMenuItem onClick={() => setEditingWallet(wallet)}>
														<Pencil className='mr-2 h-4 w-4' />
														Editar
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => setInvitingWallet(wallet)}>
														<UserPlus className='mr-2 h-4 w-4' />
														Convidar
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => setDeletingWallet(wallet)}
														className='text-destructive focus:text-destructive'
													>
														<Trash2 className='mr-2 h-4 w-4' />
														Excluir
													</DropdownMenuItem>
												</>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</li>
						);
					})}
				</ul>
			)}

			<WalletFormDialog
				open={Boolean(editing_wallet)}
				onOpenChange={(open) => !open && setEditingWallet(null)}
				wallet={editing_wallet}
			/>

			<WalletInviteFormDialog
				open={Boolean(inviting_wallet)}
				onOpenChange={(open) => !open && setInvitingWallet(null)}
				wallet={inviting_wallet}
			/>

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
