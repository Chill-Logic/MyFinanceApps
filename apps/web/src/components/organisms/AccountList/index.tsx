import { useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TAccount } from '@myfinance/shared';
import { Banknote, Landmark, MoreVertical, Pencil, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';

import { useDeleteAccount } from '@/hooks/api/accounts/useDeleteAccount';
import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import AccountFormDialog from '@/components/organisms/AccountFormDialog';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const KIND_ICON = {
	checking: Landmark,
	savings: PiggyBank,
	cash: Banknote,
} as const;

const AccountList = () => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();

	const wallet_id = user_wallet.data?.id;
	const { data: accounts_data, isLoading: is_accounts_loading } = useIndexAccounts({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: deleteAccountMutation, isPending: is_delete_pending } = useDeleteAccount();

	const [ is_create_open, setIsCreateOpen ] = useState(false);
	const [ editing_account, setEditingAccount ] = useState<TAccount | null>(null);
	const [ deleting_account, setDeletingAccount ] = useState<TAccount | null>(null);

	const accounts = accounts_data?.data || [];
	const is_loading = is_wallet_loading || is_accounts_loading;

	const handleConfirmDelete = () => {
		if (!deleting_account) return;

		deleteAccountMutation({
			id: deleting_account.id,
			onSuccess: () => {
				toast.success('Conta removida com sucesso');
				setDeletingAccount(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover conta'));
				setDeletingAccount(null);
			},
		});
	};

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center justify-between gap-3'>
				<span className='text-sm text-muted-foreground'>Dinheiro real — corrente, poupança ou espécie</span>
				<Button type='button' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id} className='gap-2'>
					<Plus className='h-4 w-4' />
					Nova conta
				</Button>
			</div>

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className='h-16 w-full' />
					))}
				</div>
			)}

			{!is_loading && accounts.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<Wallet className='h-10 w-10 text-muted-foreground' />
					<div className='flex flex-col gap-1'>
						<span className='font-medium'>Nenhuma conta ainda</span>
						<span className='text-sm text-muted-foreground'>Crie uma conta para registrar transações e ver seu saldo.</span>
					</div>
					<Button type='button' variant='secondary' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id} className='gap-2'>
						<Plus className='h-4 w-4' />
						Criar conta
					</Button>
				</div>
			)}

			{!is_loading && accounts.length > 0 && (
				<ul className='flex flex-col gap-2'>
					{accounts.map((account) => {
						const Icon = KIND_ICON[account.kind] || Wallet;

						return (
							<li key={account.id} className='flex items-center gap-3 rounded-lg border border-card bg-card p-4'>
								<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
									<Icon className='h-5 w-5' />
								</div>

								<div className='min-w-0 flex-1'>
									<p className='truncate font-medium text-foreground'>{account.name}</p>
									<p className='text-xs uppercase tracking-wide text-muted-foreground'>{account.translated_kind}</p>
								</div>

								<span className={cn('shrink-0 font-semibold', account.balance >= 0 ? 'text-feedback-success-default' : 'text-destructive')}>
									{MoneyUtils.formatMoney(account.balance)}
								</span>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button type='button' variant='ghost' size='icon' aria-label='Ações da conta' className='shrink-0'>
											<MoreVertical className='h-4 w-4' />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={() => setEditingAccount(account)}>
											<Pencil className='mr-2 h-4 w-4' />
											Editar
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setDeletingAccount(account)} className='text-destructive focus:text-destructive'>
											<Trash2 className='mr-2 h-4 w-4' />
											Excluir
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						);
					})}
				</ul>
			)}

			<AccountFormDialog open={is_create_open} onOpenChange={setIsCreateOpen} />
			<AccountFormDialog
				open={Boolean(editing_account)}
				onOpenChange={(open) => !open && setEditingAccount(null)}
				account={editing_account}
			/>

			<AlertDialog open={Boolean(deleting_account)} onOpenChange={(open) => !open && setDeletingAccount(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir conta</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir "{deleting_account?.name}"? As transações vinculadas também serão removidas. Essa ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default AccountList;
