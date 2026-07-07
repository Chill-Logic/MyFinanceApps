import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';

import { useWallet } from '@/context/wallet';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WalletSwitcher = () => {
	const { data: wallets } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();

	if (!wallets?.length) return null;

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
