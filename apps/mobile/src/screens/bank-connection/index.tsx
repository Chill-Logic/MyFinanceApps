import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

import Icon from '@expo/vector-icons/MaterialIcons';
import { BankConnectionUtils } from '@myfinance/shared';
import { RouteProp, useRoute } from '@react-navigation/native';

import { useIndexBankAccountLinks } from '../../hooks/api/bank-account-links/useIndexBankAccountLinks';
import { useShowBankConnection } from '../../hooks/api/bank-connections/useShowBankConnection';

import { useRefresh } from '../../context/refresh';
import { useTheme } from '../../context/theme';

import { IScreenProps } from '../../types/screen';

import { Loader } from '../../components/atoms/Loader';
import { ThemedText } from '../../components/atoms/ThemedText';
import { ThemedView } from '../../components/atoms/ThemedView';
import AuthenticatedLayout from '../../components/layouts/AuthenticatedLayout';
import { BankAccountLinkCard } from '../../components/organisms/BankAccountLinkCard';

export type TBankConnectionAccountsParams = {
	bank_connection_id: string;
};

/* "Contas do banco": um card por conta/cartão que a Pluggy trouxe da conexão, pra escolher destino, importar e ligar a rotina. */
const BankConnectionAccountsScreen = ({ navigation }: IScreenProps<'BankConnectionAccounts'>) => {
	const { theme } = useTheme();
	const route = useRoute<RouteProp<{ BankConnectionAccounts: TBankConnectionAccountsParams }, 'BankConnectionAccounts'>>();
	const bank_connection_id = route.params?.bank_connection_id;

	const { data: connection, isLoading: is_connection_loading } = useShowBankConnection({ id: bank_connection_id });
	const { data: links_data, isLoading: is_links_loading } = useIndexBankAccountLinks({
		enabled: Boolean(bank_connection_id),
		params: { bank_connection_id: bank_connection_id || '' },
	});
	const { refreshControlProps } = useRefresh({ all: true });

	const links = links_data?.data || [];
	const is_loading = is_connection_loading || is_links_loading;

	return (
		<AuthenticatedLayout navigation={navigation}>
			<ThemedView style={styles.container}>
				<View style={styles.header}>
					<TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						<Icon name='arrow-back' size={24} color={theme.colors.text} />
					</TouchableOpacity>
					<View style={styles.headerInfo}>
						<ThemedText style={styles.title}>Contas do banco</ThemedText>
						{connection ? (
							<ThemedText style={styles.subtle} numberOfLines={1}>
								{connection.connector_name || 'Banco'} · {BankConnectionUtils.lastSyncLabel(connection)}
							</ThemedText>
						) : null}
					</View>
				</View>

				<ThemedText style={[ styles.subtle, styles.help ]}>
					Escolha para onde cada conta ou cartão do banco vai. Nada é importado até você importar um período ou ligar a sincronização automática.
				</ThemedText>

				{is_loading && (
					<View style={styles.centered}>
						<Loader />
					</View>
				)}

				{!is_loading && links.length === 0 && (
					<View style={styles.centered}>
						<ThemedText style={styles.emptyTitle}>Nenhuma conta encontrada nesta conexão</ThemedText>
					</View>
				)}

				{!is_loading && connection && links.length > 0 && (
					<FlatList
						data={links}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => <BankAccountLinkCard link={item} walletId={connection.wallet_id} />}
						showsVerticalScrollIndicator={false}
						refreshControl={<RefreshControl {...refreshControlProps} />}
					/>
				)}
			</ThemedView>
		</AuthenticatedLayout>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginBottom: 8,
	},
	headerInfo: {
		flex: 1,
	},
	title: {
		fontSize: 22,
		fontWeight: 'bold',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	help: {
		marginBottom: 16,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
		textAlign: 'center',
	},
});

export default BankConnectionAccountsScreen;
