import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';

import { useWallet } from '@/context/wallet';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const WalletSwitcher = () => {
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();

	if (isLoading) {
		return (
			<div className='flex flex-col gap-1'>
				<span className='px-1 text-xs font-medium text-muted-foreground'>Visualizando a carteira</span>
				<Skeleton className='h-9 w-full' />
			</div>
		);
	}

	const wallets = data_wallets?.data || [];

	if (!wallets.length) return null;

	return (
		<div className='flex flex-col gap-1'>
			<span className='px-1 text-xs font-medium text-muted-foreground'>Visualizando a carteira</span>
			<Select
				value={user_wallet.data?.id}
				onValueChange={(value) => {
					const wallet = wallets.find((item) => item.id === value);
					if (wallet) setUserWallet({ data: wallet });
				}}
			>
				<SelectTrigger>
					<SelectValue placeholder='Selecione uma carteira' />
				</SelectTrigger>
				<SelectContent>
					{wallets.map((wallet) => (
						<SelectItem key={wallet.id} value={wallet.id}>
							{wallet.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};

export default WalletSwitcher;
