import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCurrentUserContext } from '../../context/current_user';

import { IScreenProps } from '../../types/screen';

import SegmentedControl from '../../components/atoms/SegmentedControl';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { AccountList } from '../../components/organisms/AccountList';
import { BankConnectionList } from '../../components/organisms/BankConnectionList';
import { CreditBalanceList } from '../../components/organisms/CreditBalanceList';

type TTab = 'accounts' | 'cards' | 'connections';

const TABS = [
	{ value: 'accounts', label: 'Contas', icon: 'account-balance-wallet' },
	{ value: 'cards', label: 'Cartões', icon: 'credit-card' },
];

/* Só para usuários liberados na integração bancária (Pluggy em período de testes). */
const CONNECTIONS_TAB = { value: 'connections', label: 'Bancos', icon: 'link' };

const FinancesScreen = ({ navigation }: IScreenProps<'Finances'>) => {
	const { current_user } = useCurrentUserContext();
	const [ tab, setTab ] = useState<TTab>('accounts');

	const pluggy_enabled = Boolean(current_user.data?.pluggy_enabled);
	const tabs = pluggy_enabled ? [ ...TABS, CONNECTIONS_TAB ] : TABS;
	const active_tab = tab === 'connections' && !pluggy_enabled ? 'accounts' : tab;

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedText style={styles.title}>Contas & Cartões</ThemedText>

				<View style={styles.tabsWrapper}>
					<SegmentedControl
						segments={tabs}
						value={active_tab}
						onChange={(next) => setTab(next as TTab)}
					/>
				</View>

				<ThemedView style={styles.content}>
					{active_tab === 'accounts' && <AccountList />}
					{active_tab === 'cards' && <CreditBalanceList />}
					{active_tab === 'connections' && <BankConnectionList />}
				</ThemedView>
			</ThemedView>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	title: {
		fontSize: 22,
		fontWeight: 'bold',
		marginBottom: 16,
	},
	tabsWrapper: {
		marginBottom: 16,
	},
	content: {
		flex: 1,
	},
});

export default FinancesScreen;
