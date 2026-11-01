import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CreditCard, Link2, Wallet } from 'lucide-react';

import { useCurrentUserContext } from '@/context/current_user';

import Typography from '@/components/atoms/Typography';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import AccountList from '@/components/organisms/AccountList';
import BankConnectionList from '@/components/organisms/BankConnectionList';
import CreditBalanceList from '@/components/organisms/CreditBalanceList';

const TAB_VALUES = [ 'accounts', 'cards', 'connections' ] as const;

type TTab = typeof TAB_VALUES[number];

const initialTab = (value: string | null): TTab => (TAB_VALUES.includes(value as TTab) ? (value as TTab) : 'accounts');

const TABS = [
	{ value: 'accounts', label: 'Contas', icon: Wallet },
	{ value: 'cards', label: 'Cartões', icon: CreditCard },
];

/* Só para usuários liberados na integração bancária (Pluggy em período de testes). */
const CONNECTIONS_TAB = { value: 'connections', label: 'Bancos', icon: Link2 };

const FinancesPage = () => {
	const { current_user } = useCurrentUserContext();
	const [ search_params ] = useSearchParams();
	/* `?tab=connections` = voltar da tela "Contas do banco" direto na aba Bancos. */
	const [ tab, setTab ] = useState<TTab>(() => initialTab(search_params.get('tab')));

	const pluggy_enabled = Boolean(current_user.data?.pluggy_enabled);
	const tabs = pluggy_enabled ? [ ...TABS, CONNECTIONS_TAB ] : TABS;
	const active_tab = tab === 'connections' && !pluggy_enabled ? 'accounts' : tab;

	return (
		<div className='flex flex-col gap-5'>
			<Typography variant='large' className='dark:text-white'>
				Contas &amp; Cartões
			</Typography>

			<SegmentedControl segments={tabs} value={active_tab} onChange={(next) => setTab(next as TTab)} />

			{active_tab === 'accounts' && <AccountList />}
			{active_tab === 'cards' && <CreditBalanceList />}
			{active_tab === 'connections' && <BankConnectionList />}
		</div>
	);
};

export default FinancesPage;
