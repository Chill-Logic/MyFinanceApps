import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CreditCard, Link2, Plus, Repeat, Wallet } from 'lucide-react';

import { useCurrentUserContext } from '@/context/current_user';
import { usePrimaryAction } from '@/context/primaryAction';
import { TAB_SLUGS } from '@/util/routeSlugs';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import AccountList from '@/components/organisms/AccountList';
import BankConnectionList from '@/components/organisms/BankConnectionList';
import CreditBalanceList from '@/components/organisms/CreditBalanceList';
import RecurrenceList from '@/components/organisms/RecurrenceList';

const TAB_VALUES = [ 'accounts', 'cards', 'recurrences', 'connections' ] as const;

type TTab = typeof TAB_VALUES[number];

const initialTab = (slug: string | null): TTab => TAB_VALUES.find((value) => TAB_SLUGS[value] === slug) ?? 'accounts';

const TABS = [
	{ value: 'accounts', label: 'Contas', icon: Wallet },
	{ value: 'cards', label: 'Cartões', icon: CreditCard },
	{ value: 'recurrences', label: 'Recorrências', icon: Repeat },
];

/* Só para usuários liberados na integração bancária (Pluggy em período de testes). */
const CONNECTIONS_TAB = { value: 'connections', label: 'Bancos', icon: Link2 };

const FinancesPage = () => {
	const { current_user } = useCurrentUserContext();
	const [ search_params ] = useSearchParams();
	/* `?aba=bancos` = voltar da tela "Contas do banco" direto na aba Bancos. */
	const [ tab, setTab ] = useState<TTab>(() => initialTab(search_params.get('aba')));
	/* "Nova recorrência" fica no cabeçalho (como no mockup); o formulário abre dentro da aba. */
	const [ creating_recurrence, setCreatingRecurrence ] = useState(false);
	/* "Conectar banco" (aba Bancos): cada incremento abre o widget da Pluggy dentro da aba. */
	const [ connect_request, setConnectRequest ] = useState(0);
	/* "Nova conta" / "Novo cartão" (o "+" da barra no celular): cada incremento abre o formulário da aba. */
	const [ create_request, setCreateRequest ] = useState(0);

	const pluggy_enabled = Boolean(current_user.data?.pluggy_enabled);
	const tabs = pluggy_enabled ? [ ...TABS, CONNECTIONS_TAB ] : TABS;
	const active_tab = tab === 'connections' && !pluggy_enabled ? 'accounts' : tab;

	/* A ação principal muda com a aba: é o "+" da barra flutuante no celular. */
	const PRIMARY_LABEL: Record<TTab, string> = { accounts: 'Nova conta', cards: 'Novo cartão', recurrences: 'Nova recorrência', connections: 'Conectar banco' };
	const runPrimary = () => {
		if (active_tab === 'recurrences') setCreatingRecurrence(true);
		else if (active_tab === 'connections') setConnectRequest((count) => count + 1);
		else setCreateRequest((count) => count + 1);
	};
	usePrimaryAction({ label: PRIMARY_LABEL[active_tab], onClick: runPrimary });

	return (
		<div className='flex flex-col gap-5'>
			<div className='flex items-center justify-between gap-3'>
				<Typography variant='large' className='dark:text-white'>
					Contas &amp; Cartões
				</Typography>
				{active_tab === 'connections' && (
					<Button type='button' onClick={() => setConnectRequest((count) => count + 1)} className='font-bold max-md:hidden'>
						<Plus className='size-4' />
						Conectar banco
					</Button>
				)}
				{active_tab === 'recurrences' && (
					<Button type='button' variant='outline' onClick={() => setCreatingRecurrence(true)} className='max-md:hidden'>
						<Plus className='size-4' />
						Nova recorrência
					</Button>
				)}
			</div>

			<SegmentedControl segments={tabs} value={active_tab} onChange={(next) => setTab(next as TTab)} />

			{active_tab === 'accounts' && <AccountList createRequest={create_request} />}
			{active_tab === 'cards' && <CreditBalanceList createRequest={create_request} />}
			{active_tab === 'recurrences' && <RecurrenceList creating={creating_recurrence} onCreatingChange={setCreatingRecurrence} />}
			{active_tab === 'connections' && <BankConnectionList connectRequest={connect_request} />}
		</div>
	);
};

export default FinancesPage;
