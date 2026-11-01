import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { PluggyConnect } from 'react-native-pluggy-connect';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { BankConnectionUtils, colors, getApiErrorMessage } from '@myfinance/shared';
import { useNavigation } from '@react-navigation/native';

import { useConnectBankToken } from '../../../hooks/api/bank-connections/useConnectBankToken';
import { useCreateBankConnection } from '../../../hooks/api/bank-connections/useCreateBankConnection';
import { useDeleteBankConnection } from '../../../hooks/api/bank-connections/useDeleteBankConnection';
import { useIndexBankConnections } from '../../../hooks/api/bank-connections/useIndexBankConnections';
import { useSyncBankConnection } from '../../../hooks/api/bank-connections/useSyncBankConnection';
import { useBankConnectionRefresh } from '../../../hooks/useBankConnectionRefresh';

import { useRefresh } from '../../../context/refresh';
import { useTheme } from '../../../context/theme';
import { useWallet } from '../../../context/wallet';

import { TBankConnection, TBankImport } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

/* Widget aberto: token novo a cada abertura; `connection` presente = modo atualização (reconectar). */
type TWidgetState = {
	token: string;
	connection: TBankConnection | null;
};

const TONE_COLOR = {
	success: colors['feedback-success-default'],
	warning: colors['feedback-warning-default'],
	error: colors['feedback-danger-default'],
	neutral: '#888',
} as const;

const ConnectorLogo = ({ connection }: { connection: TBankConnection }) => {
	const [ failed, setFailed ] = useState(false);
	const brand_color = BankConnectionUtils.brandColor(connection);

	if (connection.connector_image_url && !failed) {
		return (
			<Image
				source={{ uri: connection.connector_image_url }}
				onError={() => setFailed(true)}
				style={styles.logo}
				resizeMode='contain'
			/>
		);
	}

	return (
		<View style={[ styles.iconCircle, brand_color ? { backgroundColor: brand_color } : null ]}>
			<Icon name='account-balance' size={20} color={brand_color ? '#fff' : colors['brand-secondary']} />
		</View>
	);
};

export const BankConnectionList = () => {
	const { theme, mode } = useTheme();
	const card_surface = mode === 'dark' ? '#121214' : '#ffffff';
	const { user_wallet } = useWallet();
	const wallet_id = user_wallet.data?.id;
	const navigation = useNavigation<{ navigate(route: string, params?: object): void }>();

	const { data, isLoading } = useIndexBankConnections({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: connectTokenMutation, isPending: is_token_pending } = useConnectBankToken();
	const { mutate: createConnectionMutation, isPending: is_create_pending } = useCreateBankConnection();
	const { mutate: syncConnectionMutation } = useSyncBankConnection();
	const { mutate: deleteConnectionMutation } = useDeleteBankConnection();
	const { refreshControlProps } = useRefresh({ all: true });

	const [ widget, setWidget ] = useState<TWidgetState | null>(null);
	const [ syncing_id, setSyncingId ] = useState<string | null>(null);
	const [ actions_connection, setActionsConnection ] = useState<TBankConnection | null>(null);

	const connections = data?.data || [];

	const notifyImports = (imports: TBankImport[]) => Toast.show({
		type: 'success',
		text1: 'Atualizado',
		text2: imports.length > 0 ? BankConnectionUtils.importSummaryMessage(imports) : 'Nada novo para importar',
	});

	const notifyError = (title: string) => (error?: unknown) => Toast.show({
		type: 'error',
		text1: title,
		text2: getApiErrorMessage(error, 'Tente novamente'),
	});

	const { refresh, refreshing_id } = useBankConnectionRefresh({
		onFinished: ({ imports }) => notifyImports(imports),
		onFailed: (error, message) => (message
			? Toast.show({ type: 'error', text1: 'Erro ao atualizar a conexão', text2: message })
			: notifyError('Erro ao atualizar a conexão')(error)),
	});

	const openAccounts = (connection: Pick<TBankConnection, 'id'>) =>
		navigation.navigate('BankConnectionAccounts', { bank_connection_id: connection.id });

	const openWidget = (connection: TBankConnection | null = null) => {
		connectTokenMutation({
			body: connection ? { bank_connection_id: connection.id } : {},
			onSuccess: ({ access_token }) => setWidget({ token: access_token, connection }),
			onError: notifyError('Erro ao iniciar a conexão com o banco'),
		});
	};

	/* Depois de reconectar, a Pluggy já buscou no banco: só roda a rotina pra trazer o que chegou. */
	const handleSync = (connection: TBankConnection) => {
		setSyncingId(connection.id);
		syncConnectionMutation({
			id: connection.id,
			onSuccess: ({ imports }) => {
				notifyImports(imports);
				setSyncingId(null);
			},
			onError: (error) => {
				notifyError('Erro ao sincronizar')(error);
				setSyncingId(null);
			},
		});
	};

	const handleWidgetSuccess = (item_id: string) => {
		const updated_connection = widget?.connection;
		setWidget(null);

		if (updated_connection) {
			handleSync(updated_connection);
			return;
		}

		if (!wallet_id) return;

		createConnectionMutation({
			body: { wallet_id, item_id },
			onSuccess: ({ data: connection }) => {
				Toast.show({ type: 'success', text1: 'Banco conectado', text2: 'Escolha o que importar.' });
				openAccounts(connection);
			},
			onError: notifyError('Erro ao salvar a conexão bancária'),
		});
	};

	const handleDisconnect = (connection: TBankConnection) => {
		setTimeout(() => {
			Alert.alert(
				'Desconectar banco',
				`Deseja desconectar "${ connection.connector_name || 'Banco' }"? As contas, cartões e transações já importados continuam na carteira, mas deixam de ser atualizados.`,
				[
					{ text: 'Cancelar', style: 'cancel' },
					{
						text: 'Desconectar',
						style: 'destructive',
						onPress: () => {
							deleteConnectionMutation({
								id: connection.id,
								onSuccess: () => Toast.show({ type: 'success', text1: 'Banco desconectado' }),
								onError: notifyError('Erro ao desconectar o banco'),
							});
						},
					},
				],
			);
		}, 100);
	};

	const runAction = (action: (connection: TBankConnection)=> void) => {
		const target = actions_connection;
		setActionsConnection(null);
		if (target) action(target);
	};

	const renderConnectionItem = ({ item }: { item: TBankConnection }) => {
		const status = BankConnectionUtils.status(item.status);
		const is_busy = syncing_id === item.id || refreshing_id === item.id;

		return (
			<ThemedView style={[ styles.row, { backgroundColor: card_surface } ]}>
				<TouchableOpacity style={styles.rowMain} onPress={() => openAccounts(item)}>
					<ConnectorLogo connection={item} />

					<View style={styles.info}>
						<ThemedText numberOfLines={1}>{item.connector_name || 'Banco'}</ThemedText>
						<ThemedText style={styles.subtle} numberOfLines={1}>
							<ThemedText style={[ styles.subtle, { color: TONE_COLOR[status.tone] } ]}>{is_busy ? 'Atualizando…' : status.label}</ThemedText>
							{` · ${ BankConnectionUtils.lastSyncLabel(item) }`}
						</ThemedText>
					</View>
				</TouchableOpacity>

				{is_busy ? (
					<ActivityIndicator color={colors['brand-secondary']} />
				) : (
					<TouchableOpacity onPress={() => setActionsConnection(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
						<Icon name='more-vert' size={22} color={theme.colors.placeholder} />
					</TouchableOpacity>
				)}
			</ThemedView>
		);
	};

	return (
		<ThemedView style={styles.container}>
			<TouchableOpacity
				style={[ styles.newButton, (is_token_pending || is_create_pending) && styles.disabled ]}
				onPress={() => openWidget()}
				disabled={!wallet_id || is_token_pending || is_create_pending}
			>
				{is_token_pending && !widget ? <ActivityIndicator color='#fff' size='small' /> : <Icon name='add-link' size={20} color='#fff' />}
				<ThemedText style={styles.newButtonText}>Conectar banco</ThemedText>
			</TouchableOpacity>

			{is_create_pending && (
				<View style={styles.importing}>
					<ActivityIndicator color={colors['brand-secondary']} />
					<ThemedText style={styles.subtle}>Salvando a conexão…</ThemedText>
				</View>
			)}

			{isLoading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!isLoading && connections.length === 0 && !is_create_pending && (
				<View style={styles.centered}>
					<ThemedText style={styles.emptyTitle}>Nenhum banco conectado</ThemedText>
					<ThemedText style={styles.emptyMessage}>Conecte um banco e escolha, conta por conta, o que importar.</ThemedText>
				</View>
			)}

			{!isLoading && connections.length > 0 && (
				<FlatList
					data={connections}
					renderItem={renderConnectionItem}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					refreshControl={<RefreshControl {...refreshControlProps} />}
				/>
			)}

			<Modal visible={Boolean(actions_connection)} transparent animationType='fade' onRequestClose={() => setActionsConnection(null)}>
				<TouchableOpacity style={styles.actionsSheetOverlay} activeOpacity={1} onPress={() => setActionsConnection(null)}>
					<ThemedView style={styles.actionsSheet}>
						<TouchableOpacity
							style={[ styles.actionsSheetItem, Boolean(refreshing_id) && styles.disabled ]}
							onPress={() => runAction(refresh)}
							disabled={Boolean(refreshing_id)}
						>
							<Icon name='sync' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Atualizar agora</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity style={styles.actionsSheetItem} onPress={() => runAction(openAccounts)}>
							<Icon name='checklist' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Contas do banco</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity style={styles.actionsSheetItem} onPress={() => runAction(openWidget)}>
							<Icon name='link' size={20} color={theme.colors.text} />
							<ThemedText style={styles.actionsSheetItemText}>Reconectar</ThemedText>
						</TouchableOpacity>

						<TouchableOpacity style={styles.actionsSheetItem} onPress={() => runAction(handleDisconnect)}>
							<Icon name='link-off' size={20} color={colors['feedback-danger-default']} />
							<ThemedText style={[ styles.actionsSheetItemText, { color: colors['feedback-danger-default'] } ]}>Desconectar</ThemedText>
						</TouchableOpacity>
					</ThemedView>
				</TouchableOpacity>
			</Modal>

			<Modal visible={Boolean(widget)} animationType='slide' onRequestClose={() => setWidget(null)}>
				{widget && (
					<PluggyConnect
						connectToken={widget.token}
						updateItem={widget.connection?.external_id}
						includeSandbox
						language='pt'
						theme={mode}
						onSuccess={({ item }) => handleWidgetSuccess(item.id)}
						onError={({ message }) => {
							Toast.show({ type: 'error', text1: 'Não foi possível conectar ao banco', text2: message });
						}}
						onClose={() => setWidget(null)}
					/>
				)}
			</Modal>
		</ThemedView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	newButton: {
		alignSelf: 'flex-end',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: colors['brand-secondary'],
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	disabled: {
		opacity: 0.6,
	},
	newButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: 'bold',
	},
	importing: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginBottom: 12,
	},
	centered: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 6,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	emptyMessage: {
		textAlign: 'center',
		color: '#666',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderRadius: 8,
		marginBottom: 10,
		padding: 14,
	},
	logo: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: '#fff',
	},
	iconCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.08)',
	},
	rowMain: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	info: {
		flex: 1,
		backgroundColor: 'transparent',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	actionsSheetOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.4)',
	},
	actionsSheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingTop: 8,
		paddingBottom: 28,
	},
	actionsSheetItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	actionsSheetItemText: {
		fontSize: 16,
	},
});

export default BankConnectionList;
