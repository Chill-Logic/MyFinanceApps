import { useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Icon from '@expo/vector-icons/MaterialIcons';
import { ClaudeSessionUtils, colors, DateUtils, getApiErrorMessage } from '@myfinance/shared';

import { useIndexClaudeSessions } from '../../../hooks/api/claude-sessions/useIndexClaudeSessions';
import { useIndexClaudeToolCalls } from '../../../hooks/api/claude-sessions/useIndexClaudeToolCalls';
import { useRevokeClaudeSession } from '../../../hooks/api/claude-sessions/useRevokeClaudeSession';

import { useTheme } from '../../../context/theme';

import { TClaudeSession, TClaudeToolCall } from '../../../types/models';

import { Loader } from '../../atoms/Loader';
import { ThemedText } from '../../atoms/ThemedText';
import { ThemedView } from '../../atoms/ThemedView';

interface ClaudeConnectionsModalProps {
	visible: boolean;
	onClose: ()=> void;
}

const TONE_COLOR = {
	success: colors['feedback-success-default'],
	warning: colors['feedback-warning-default'],
	error: colors['feedback-danger-default'],
	neutral: '#888',
} as const;

/**
 * Conexões do Claude (conector MCP) — item "Conexões com o Claude" das Configurações. Mostra o
 * endereço do MCP (selecionável + compartilhar, sem lib de clipboard nativa), as conexões com
 * status/acesso/último uso, a atividade de cada uma (sub-visão dentro do próprio modal) e revogar.
 */
export const ClaudeConnectionsModal = ({ visible, onClose }: ClaudeConnectionsModalProps) => {
	const { theme } = useTheme();
	const { data, isLoading } = useIndexClaudeSessions({ enabled: visible });
	const { mutate: revokeMutation, isPending: is_revoke_pending } = useRevokeClaudeSession();

	const [ activity_session, setActivitySession ] = useState<TClaudeSession | null>(null);
	const { data: tool_calls_data, isLoading: is_tool_calls_loading } = useIndexClaudeToolCalls({
		enabled: visible,
		session_id: activity_session?.id,
	});

	const sessions = data?.data || [];
	const current_sessions = sessions.filter(ClaudeSessionUtils.isRevocable);
	const past_sessions = sessions.filter((session) => !ClaudeSessionUtils.isRevocable(session));
	const tool_calls = tool_calls_data?.data || [];
	const mcp_url = data?.mcp_url;

	const handleClose = () => {
		setActivitySession(null);
		onClose();
	};

	const handleShare = () => {
		if (!mcp_url) return;

		Share.share({ message: mcp_url });
	};

	const handleRevoke = (session: TClaudeSession) => {
		Alert.alert(
			'Revogar conexão',
			`O Claude perde o acesso à sua conta por "${ session.name }" na hora. Para usar de novo, será preciso autorizar outra vez no Claude.`,
			[
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Revogar',
					style: 'destructive',
					onPress: () => {
						revokeMutation({
							id: session.id,
							onSuccess: () => Toast.show({ type: 'success', text1: 'Conexão revogada' }),
							onError: (error) => Toast.show({
								type: 'error',
								text1: 'Não foi possível revogar',
								text2: getApiErrorMessage(error, 'Tente novamente'),
							}),
						});
					},
				},
			],
		);
	};

	const renderSession = (session: TClaudeSession) => {
		const status = ClaudeSessionUtils.statusLabel(session.status);
		const is_revocable = ClaudeSessionUtils.isRevocable(session);

		return (
			<View key={session.id} style={[ styles.item, { borderColor: theme.colors.border }, !is_revocable && styles.inactive ]}>
				<View style={styles.itemHeader}>
					<View style={styles.itemInfo}>
						<ThemedText style={styles.itemTitle} numberOfLines={1}>{session.name}</ThemedText>
						<ThemedText style={styles.subtle} numberOfLines={1}>
							{ClaudeSessionUtils.scopeLabel(session.scope)}
							{session.client_name ? ` · ${ session.client_name }` : ''}
						</ThemedText>
					</View>
					<ThemedText style={[ styles.status, { color: TONE_COLOR[status.tone] } ]}>{status.label}</ThemedText>
				</View>

				<ThemedText style={styles.subtle}>{ClaudeSessionUtils.lastUsedLabel(session)}</ThemedText>
				<ThemedText style={styles.subtle}>{ClaudeSessionUtils.expirationLabel(session)}</ThemedText>

				<View style={styles.actions}>
					<TouchableOpacity
						style={[ styles.actionButton, { borderColor: theme.colors.border } ]}
						onPress={() => setActivitySession(session)}
					>
						<Icon name='history' size={16} color={theme.colors.text} />
						<ThemedText style={styles.actionText}>Atividade</ThemedText>
					</TouchableOpacity>
					{is_revocable && (
						<TouchableOpacity
							style={[ styles.actionButton, styles.dangerButton, is_revoke_pending && styles.disabled ]}
							onPress={() => handleRevoke(session)}
							disabled={is_revoke_pending}
						>
							<Icon name='block' size={16} color='#ffffff' />
							<ThemedText style={[ styles.actionText, styles.dangerText ]}>Revogar</ThemedText>
						</TouchableOpacity>
					)}
				</View>
			</View>
		);
	};

	const renderToolCall = (call: TClaudeToolCall) => {
		const status = ClaudeSessionUtils.toolCallStatusLabel(call.status);

		return (
			<View key={call.id} style={[ styles.item, { borderColor: theme.colors.border } ]}>
				<View style={styles.itemHeader}>
					<View style={styles.itemInfo}>
						<ThemedText style={styles.itemTitle} numberOfLines={1}>{call.tool_title}</ThemedText>
						<ThemedText style={styles.subtle}>
							{DateUtils.formateTo(call.created_at, 'dd/MM/yyyy \'às\' HH:mm:ss')}
							{` · ${ call.kind === 'write' ? 'Escrita' : 'Leitura' }`}
						</ThemedText>
					</View>
					<ThemedText style={[ styles.status, { color: TONE_COLOR[status.tone] } ]}>{status.label}</ThemedText>
				</View>
				{call.error_message ? <ThemedText style={styles.subtle}>{call.error_message}</ThemedText> : null}
			</View>
		);
	};

	const renderActivity = () => (
		<>
			<TouchableOpacity style={styles.backButton} onPress={() => setActivitySession(null)}>
				<Icon name='chevron-left' size={20} color={theme.colors.placeholder} />
				<ThemedText style={styles.subtle}>Voltar</ThemedText>
			</TouchableOpacity>
			<ThemedText style={styles.subtle}>{activity_session?.name}</ThemedText>

			{is_tool_calls_loading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!is_tool_calls_loading && tool_calls.length === 0 && (
				<View style={styles.centered}>
					<Icon name='history' size={40} color={theme.colors.placeholder} />
					<ThemedText style={styles.emptyTitle}>Nenhuma atividade ainda</ThemedText>
				</View>
			)}

			{!is_tool_calls_loading && tool_calls.length > 0 && (
				<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
					{tool_calls.map(renderToolCall)}
				</ScrollView>
			)}
		</>
	);

	const renderSessions = () => (
		<ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
			<ThemedText style={styles.subtle}>
				No Claude, vá em Configurações → Conectores → Adicionar conector personalizado e cole o endereço abaixo.
				Você escolhe o nível de acesso e a validade ao autorizar.
			</ThemedText>

			<View style={[ styles.urlBox, { borderColor: theme.colors.border } ]}>
				<ThemedText style={styles.urlText} selectable numberOfLines={2}>{mcp_url || '…'}</ThemedText>
				<TouchableOpacity onPress={handleShare} disabled={!mcp_url} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<Icon name='share' size={20} color={theme.colors.text} />
				</TouchableOpacity>
			</View>

			{isLoading && (
				<View style={styles.centered}>
					<Loader />
				</View>
			)}

			{!isLoading && sessions.length === 0 && (
				<View style={styles.centered}>
					<Icon name='smart-toy' size={40} color={theme.colors.placeholder} />
					<ThemedText style={styles.emptyTitle}>Nenhuma conexão ainda</ThemedText>
				</View>
			)}

			{current_sessions.map(renderSession)}

			{past_sessions.length > 0 && (
				<>
					<ThemedText style={styles.sectionLabel}>Revogadas e expiradas</ThemedText>
					{past_sessions.map(renderSession)}
				</>
			)}
		</ScrollView>
	);

	return (
		<Modal visible={visible} transparent animationType='fade' onRequestClose={handleClose}>
			<ThemedView style={styles.modalOverlay}>
				<ThemedView style={styles.modalContent}>
					<View style={styles.header}>
						<ThemedText style={styles.title} numberOfLines={1}>
							{activity_session ? 'Atividade' : 'Conexões com o Claude'}
						</ThemedText>
						<TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Icon name='close' size={22} color={theme.colors.text} />
						</TouchableOpacity>
					</View>

					{activity_session ? renderActivity() : renderSessions()}
				</ThemedView>
			</ThemedView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		width: '90%',
		maxHeight: '85%',
		padding: 20,
		borderRadius: 10,
		elevation: 5,
		gap: 8,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	title: {
		flex: 1,
		fontSize: 20,
		fontWeight: 'bold',
	},
	subtle: {
		color: '#888',
		fontSize: 13,
	},
	sectionLabel: {
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		color: '#868686',
		marginTop: 8,
		marginBottom: 8,
	},
	urlBox: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		borderWidth: 1,
		borderRadius: 8,
		padding: 10,
		marginTop: 10,
		marginBottom: 14,
	},
	urlText: {
		flex: 1,
		fontSize: 12,
		fontFamily: 'monospace',
	},
	centered: {
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 24,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	list: {
		marginTop: 4,
	},
	item: {
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		marginBottom: 10,
		gap: 4,
	},
	inactive: {
		opacity: 0.7,
	},
	itemHeader: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	itemInfo: {
		flex: 1,
	},
	itemTitle: {
		fontSize: 15,
		fontWeight: '600',
	},
	status: {
		fontSize: 12,
		fontWeight: '700',
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 8,
		marginTop: 6,
	},
	actionButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		borderWidth: 1,
		borderRadius: 6,
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	actionText: {
		fontSize: 14,
	},
	dangerButton: {
		backgroundColor: colors['feedback-danger-default'],
		borderColor: colors['feedback-danger-default'],
	},
	dangerText: {
		color: '#ffffff',
	},
	backButton: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
	},
	disabled: {
		opacity: 0.5,
	},
});

export default ClaudeConnectionsModal;
