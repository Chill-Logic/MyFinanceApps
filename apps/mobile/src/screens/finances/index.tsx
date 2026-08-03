import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IScreenProps } from '../../types/screen';

import SegmentedControl from '../../components/atoms/SegmentedControl';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { AccountList } from '../../components/organisms/AccountList';
import { CreditBalanceList } from '../../components/organisms/CreditBalanceList';

type TTab = 'accounts' | 'cards';

const FinancesScreen = ({ navigation }: IScreenProps<'Finances'>) => {
	const [ tab, setTab ] = useState<TTab>('accounts');

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<ThemedText style={styles.title}>Contas & Cartões</ThemedText>

				<View style={styles.tabsWrapper}>
					<SegmentedControl
						segments={[
							{ value: 'accounts', label: 'Contas', icon: 'account-balance-wallet' },
							{ value: 'cards', label: 'Cartões', icon: 'credit-card' },
						]}
						value={tab}
						onChange={(next) => setTab(next as TTab)}
					/>
				</View>

				<ThemedView style={styles.content}>
					{tab === 'accounts' ? <AccountList /> : <CreditBalanceList />}
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
