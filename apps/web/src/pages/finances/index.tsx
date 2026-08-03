import { useState } from 'react';

import { CreditCard, Wallet } from 'lucide-react';

import Typography from '@/components/atoms/Typography';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import AccountList from '@/components/organisms/AccountList';
import CreditBalanceList from '@/components/organisms/CreditBalanceList';

type TTab = 'accounts' | 'cards';

const TABS = [
	{ value: 'accounts', label: 'Contas', icon: Wallet },
	{ value: 'cards', label: 'Cartões', icon: CreditCard },
];

const FinancesPage = () => {
	const [ tab, setTab ] = useState<TTab>('accounts');

	return (
		<div className='flex flex-col gap-5'>
			<Typography variant='large' className='dark:text-white'>
				Contas &amp; Cartões
			</Typography>

			<SegmentedControl segments={TABS} value={tab} onChange={(next) => setTab(next as TTab)} />

			{tab === 'accounts' ? <AccountList /> : <CreditBalanceList />}
		</div>
	);
};

export default FinancesPage;
