import { useState } from 'react';

import { CreditCard, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';

import Typography from '@/components/atoms/Typography';
import AccountList from '@/components/organisms/AccountList';
import CreditBalanceList from '@/components/organisms/CreditBalanceList';

type TTab = 'accounts' | 'cards';

const TABS: { id: TTab; label: string; icon: typeof Wallet }[] = [
	{ id: 'accounts', label: 'Contas', icon: Wallet },
	{ id: 'cards', label: 'Cartões', icon: CreditCard },
];

const FinancesPage = () => {
	const [ tab, setTab ] = useState<TTab>('accounts');

	return (
		<div className='flex flex-col gap-5'>
			<Typography variant='large' className='dark:text-white'>
				Contas &amp; Cartões
			</Typography>

			<div className='flex gap-1 rounded-lg bg-muted p-1'>
				{TABS.map(({ id, label, icon: Icon }) => (
					<button
						key={id}
						type='button'
						onClick={() => setTab(id)}
						className={cn(
							'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
							tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						<Icon className='h-4 w-4' />
						{label}
					</button>
				))}
			</div>

			{tab === 'accounts' ? <AccountList /> : <CreditBalanceList />}
		</div>
	);
};

export default FinancesPage;
