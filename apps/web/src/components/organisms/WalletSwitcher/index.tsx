import { useState } from 'react';

import { Check, ChevronDown } from 'lucide-react';

import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';

import { Skeleton } from '@/components/ui/skeleton';

interface IProps {
	/** Chamado depois de selecionar uma carteira — o NavMenu (mobile) usa pra fechar o sheet. */
	onAfterSelect?: ()=> void;
}

/**
 * Seletor de carteira com expansão INLINE (acordeão) — a lista de opções abre dentro do próprio
 * fluxo, sem abrir um segundo dropdown como o `Select` fazia antes. Compartilhado entre o `Sidebar`
 * (desktop) e o `NavMenu` (bottom sheet mobile). A animação de altura usa o truque de grid
 * `0fr`→`1fr` (anima sem precisar medir/hardcodar pixel); o `overflow-hidden` no filho é
 * obrigatório pra cortar o conteúdo enquanto colapsado.
 */
const WalletSwitcher = ({ onAfterSelect }: IProps) => {
	const { data: data_wallets, isLoading } = useIndexWallets();
	const { user_wallet, setUserWallet } = useWallet();
	const [ is_open, setIsOpen ] = useState(false);

	if (isLoading) {
		return (
			<div className='flex flex-col gap-1'>
				<span className='px-3 text-xs font-medium text-muted-foreground'>Visualizando a carteira</span>
				<Skeleton className='h-9 w-full' />
			</div>
		);
	}

	const wallets = data_wallets?.data || [];

	if (!wallets.length) return null;

	const selected_label = wallets.find((wallet) => wallet.id === user_wallet.data?.id)?.name
		?? 'Selecione uma carteira';

	const handleSelect = (wallet_id: string) => {
		const wallet = wallets.find((item) => item.id === wallet_id);
		if (wallet) setUserWallet({ data: wallet });
		setIsOpen(false);
		onAfterSelect?.();
	};

	return (
		<div className='flex flex-col'>
			<button
				type='button'
				onClick={() => setIsOpen((prev) => !prev)}
				className='flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent'
			>
				<div className='min-w-0 flex-1 text-left'>
					<p className='text-xs text-muted-foreground'>Visualizando a carteira</p>
					<p className='truncate text-sm font-semibold text-foreground'>{selected_label}</p>
				</div>
				<ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', is_open && 'rotate-180')} />
			</button>

			<div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', is_open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
				<div className='overflow-hidden'>
					{wallets.map((wallet) => (
						<button
							key={wallet.id}
							type='button'
							onClick={() => handleSelect(wallet.id)}
							className='flex w-full items-center justify-between gap-2 rounded-md py-2 pl-6 pr-3 text-sm transition-colors hover:bg-accent'
						>
							<span className='truncate text-foreground'>{wallet.name}</span>
							{wallet.id === user_wallet.data?.id && <Check className='h-4 w-4 shrink-0 text-brand-secondary' />}
						</button>
					))}
				</div>
			</div>
		</div>
	);
};

export default WalletSwitcher;
