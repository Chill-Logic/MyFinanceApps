import { useNavigate } from 'react-router-dom';

import { MoneyUtils, type TWallet } from '@myfinance/shared';
import { Check, WalletCards } from 'lucide-react';

import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useNavItems from '@/hooks/useNavItems';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import { Skeleton } from '@/components/ui/skeleton';

const MyWalletsPage = () => {
	const navigate = useNavigate();
	const { newWalletAction } = useNavItems();
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();

	const wallets = data_wallets?.data || [];

	/*
	 * Selecionar uma carteira só troca a carteira ativa no contexto e volta pra Home (a visão da
	 * carteira selecionada) — mesmo comportamento do MyWalletsScreen do mobile.
	 */
	const handleSelect = (wallet: TWallet) => {
		setUserWallet({ data: wallet });
		navigate('/');
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

						return (
							<li key={wallet.id}>
								<button
									type='button'
									onClick={() => handleSelect(wallet)}
									className={cn(
										'flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent',
										is_active ? 'border-primary bg-accent' : 'border-border',
									)}
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
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default MyWalletsPage;
