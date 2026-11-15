import type { TClaudeSession, TClaudeSessionScope, TClaudeSessionStatus, TClaudeToolCallStatus } from '../models';

import { DateUtils } from './date';

type TStatusTone = 'success' | 'warning' | 'error' | 'neutral';

const SESSION_STATUS_LABELS: Record<TClaudeSessionStatus, { label: string; tone: TStatusTone }> = {
	active: { label: 'Ativa', tone: 'success' },
	pending: { label: 'Aguardando o Claude', tone: 'warning' },
	expired: { label: 'Expirada', tone: 'neutral' },
	revoked: { label: 'Revogada', tone: 'error' },
};

const SCOPE_LABELS: Record<TClaudeSessionScope, string> = {
	read: 'Somente leitura',
	read_write: 'Leitura e escrita',
};

const TOOL_CALL_STATUS_LABELS: Record<TClaudeToolCallStatus, { label: string; tone: TStatusTone }> = {
	success: { label: 'OK', tone: 'success' },
	denied: { label: 'Negada', tone: 'error' },
	not_found: { label: 'Não encontrado', tone: 'warning' },
	invalid: { label: 'Inválida', tone: 'warning' },
	error: { label: 'Erro', tone: 'error' },
};

/* Rótulos e regras de exibição das conexões do Claude (MCP), iguais no web e no mobile. */
export const ClaudeSessionUtils = {
	statusLabel: (status: TClaudeSessionStatus) => SESSION_STATUS_LABELS[status] ?? { label: status, tone: 'neutral' as TStatusTone },
	scopeLabel: (scope: TClaudeSessionScope) => SCOPE_LABELS[scope] ?? scope,
	toolCallStatusLabel: (status: TClaudeToolCallStatus) => TOOL_CALL_STATUS_LABELS[status] ?? { label: status, tone: 'neutral' as TStatusTone },
	isRevocable: (session: TClaudeSession) => session.status === 'active' || session.status === 'pending',
	lastUsedLabel: (session: TClaudeSession) => (session.last_used_at ? `Último uso: ${ DateUtils.formatDateTime(session.last_used_at) }` : 'Ainda não usada'),
	expirationLabel: (session: TClaudeSession) => {
		if (session.status === 'revoked' && session.revoked_at) return `Revogada em ${ DateUtils.formatDate(session.revoked_at) }`;
		if (session.status === 'expired') return `Expirou em ${ DateUtils.formatDate(session.expires_at) }`;
		return `Válida até ${ DateUtils.formatDate(session.expires_at) }`;
	},
};
