import type {
	TBankAccountLink,
	TMatchCandidate,
	TBankAccountLinkStatus,
	TBankConnection,
	TBankImport,
	TBankImportMode,
	TBankImportStatus,
	TBankImportTrigger,
} from '../models';

import { DateUtils } from './date';
import { MONTH_NAMES_PT } from './invoice';
import { MoneyUtils } from './money';

type TStatusTone = 'success' | 'warning' | 'error' | 'neutral';

const STATUS_LABELS: Record<string, { label: string; tone: TStatusTone }> = {
	UPDATED: { label: 'Atualizada', tone: 'success' },
	UPDATING: { label: 'Atualizando', tone: 'neutral' },
	OUTDATED: { label: 'Desatualizada', tone: 'warning' },
	WAITING_USER_INPUT: { label: 'Aguardando você', tone: 'warning' },
	WAITING_USER_ACTION: { label: 'Aguardando você', tone: 'warning' },
	LOGIN_ERROR: { label: 'Erro de login', tone: 'error' },
};

/* Status em que a Pluggy ainda está buscando no banco — o front continua fazendo polling no `show`. */
const UPDATING_STATUSES = [ 'UPDATING', 'WAITING_USER_INPUT' ];

const LINK_STATUS_LABELS: Record<TBankAccountLinkStatus, { label: string; tone: TStatusTone }> = {
	pending: { label: 'Escolha o destino', tone: 'warning' },
	linked: { label: 'Vinculada', tone: 'success' },
	ignored: { label: 'Não importar', tone: 'neutral' },
};

const IMPORT_STATUS_LABELS: Record<TBankImportStatus, { label: string; tone: TStatusTone }> = {
	completed: { label: 'Concluída', tone: 'success' },
	failed: { label: 'Falhou', tone: 'error' },
	undone: { label: 'Desfeita', tone: 'neutral' },
};

const IMPORT_MODE_LABELS: Record<TBankImportMode, string> = {
	preserve: 'Não sobrescrever',
	overwrite: 'Sobrescrever',
	update: 'Atualizar',
};

const IMPORT_TRIGGER_LABELS: Record<TBankImportTrigger, string> = {
	manual: 'Manual',
	routine: 'Automática',
};

/* Opções do modal "Importar período", na ordem de exibição. `warning` = destaque de atenção. */
export const BANK_IMPORT_MODE_OPTIONS: { value: TBankImportMode; label: string; description: string; warning?: boolean }[] = [
	{
		value: 'preserve',
		label: 'Não sobrescrever (recomendado)',
		description: 'Só traz o que ainda não existe aqui; suas edições e exclusões ficam como estão.',
	},
	{
		value: 'overwrite',
		label: 'Sobrescrever',
		description: 'Recria as transações do período do jeito que estão no banco, ignorando suas edições e exclusões.',
		warning: true,
	},
];

export const BANK_AUTO_SYNC_HELP = 'A rotina traz o que é novo e atualiza o que mudou no banco, sem mexer nos campos que você editou; o que você excluiu fica excluído.';

export const PROJECTED_HELP = 'Prevista: ainda não aconteceu. É confirmada quando você efetivar ou quando o banco trouxer a transação.';

export const BANK_BEST_PURCHASE_DAY_HELP = (suggested: number | null) => (suggested
	? `O banco não informa o fechamento deste cartão. Pela última fatura, o melhor dia de compra é o dia ${ suggested }.`
	: 'O banco não informa o fechamento deste cartão. Informe o melhor dia de compra.');

export const BANK_IMPORT_RETENTION_HELP = 'A Pluggy guarda até 12 meses de histórico.';

/* `external_data` vem em REAIS (float) — converte pra centavos antes de formatar. */
const reaisToMoney = (value?: number) => (value === undefined || value === null ? null : MoneyUtils.formatMoney(Math.round(value * 100)));

const toYmd = (date: Date) => DateUtils.formateTo(date, 'yyyy-MM-dd');

const plural = (count: number, singular: string, plural_form: string) => `${ count } ${ count === 1 ? singular : plural_form }`;

/* Status em palavras (redesign 2026-11): o que a pessoa precisa saber, não o código da Pluggy. */
const STATUS_VIEW: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral'; note?: string }> = {
	UPDATED: { label: 'Em dia', tone: 'success' },
	UPDATING: { label: 'Buscando no banco…', tone: 'info', note: 'Pode levar alguns minutos. Pode sair desta tela: o que chegar entra sozinho.' },
	OUTDATED: { label: 'Desatualizada', tone: 'warning', note: 'O banco não respondeu na última tentativa. Tente atualizar ou reconectar.' },
	WAITING_USER_INPUT: { label: 'Esperando você no banco', tone: 'warning', note: 'O banco pediu uma confirmação (código ou token). Reconecte para responder.' },
	WAITING_USER_ACTION: { label: 'Esperando você no banco', tone: 'warning', note: 'O banco pediu uma confirmação. Reconecte para responder.' },
	LOGIN_ERROR: { label: 'Precisa entrar de novo', tone: 'error', note: 'O banco encerrou o acesso (senha trocada ou acesso expirado). Nada é atualizado até você reconectar.' },
};

const SUBTYPE_LABELS: Record<string, string> = {
	CHECKING_ACCOUNT: 'Conta corrente',
	SAVINGS_ACCOUNT: 'Poupança',
	CREDIT_CARD: 'Cartão de crédito',
};

const pad = (value: number) => String(value).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shortMonth = (date: Date) => MONTH_NAMES_PT[date.getMonth()]?.slice(0, 3).toLowerCase() ?? '';

export const BankConnectionUtils = {
	/* Rótulo pt-BR e tom visual do status do item da Pluggy; status desconhecido cai no próprio valor, neutro. */
	status: (status: TBankConnection['status']) => {
		if (!status) return { label: 'Sem status', tone: 'neutral' as TStatusTone };
		return STATUS_LABELS[status] || { label: status, tone: 'neutral' as TStatusTone };
	},

	/* Login expirado/MFA pendente: só o widget em modo atualização (`updateItem`) resolve. */
	needsReconnect: (status: TBankConnection['status']) =>
		status === 'LOGIN_ERROR' || status === 'OUTDATED' || status === 'WAITING_USER_INPUT' || status === 'WAITING_USER_ACTION',

	/* A Pluggy ainda está buscando no banco (depois de "Atualizar agora"). */
	isUpdating: (status?: TBankConnection['status']) => Boolean(status) && UPDATING_STATUSES.includes(status as string),

	/* Cor da instituição como CSS válido — a Pluggy manda hex sem `#`. */
	brandColor: (connection: Pick<TBankConnection, 'connector_primary_color'>) => {
		const color = connection.connector_primary_color;
		if (!color) return null;
		return color.startsWith('#') ? color : `#${ color }`;
	},

	/* Status em palavras + nota explicativa (quando há algo a fazer ou esperar). */
	statusView: (status: TBankConnection['status']) =>
		(status && STATUS_VIEW[status]) || { label: status ? BankConnectionUtils.status(status).label : 'Sem status', tone: 'neutral' as const },

	/*
	 * Quando a conexão trouxe algo pela última vez. O backend não preenche `last_synced_at` (a rotina não grava),
	 * então vale o `last_imported_at` mais recente dos vínculos; `last_synced_at` só se um dia vier.
	 */
	lastUpdatedAt: (connection: Pick<TBankConnection, 'last_synced_at'>, links: Pick<TBankAccountLink, 'last_imported_at'>[] = []) => {
		const dates = [ connection.last_synced_at, ...links.map((link) => link.last_imported_at) ].filter(Boolean) as string[];
		if (!dates.length) return null;
		return dates.reduce((latest, date) => (new Date(date) > new Date(latest) ? date : latest));
	},

	/* "há 5 min", "há 2 h", "ontem, 18:40", "há 9 dias", "em 02/11/2025". */
	relativeTime: (iso: string, now: Date = new Date()) => {
		const date = new Date(iso);
		const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
		if (minutes < 2) return 'agora há pouco';
		if (minutes < 60) return `há ${ minutes } min`;
		if (sameDay(date, now)) return `há ${ Math.floor(minutes / 60) } h`;
		const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
		if (sameDay(date, yesterday)) return `ontem, ${ pad(date.getHours()) }:${ pad(date.getMinutes()) }`;
		const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
		if (days < 30) return `há ${ days } dias`;
		return `em ${ pad(date.getDate()) }/${ pad(date.getMonth() + 1) }/${ date.getFullYear() }`;
	},

	/* "Hoje, 06:00" / "Ontem, 18:40" / "20 nov, 06:00" / "02 nov 2025, 14:12". */
	whenLabel: (iso: string, now: Date = new Date()) => {
		const date = new Date(iso);
		const time = `${ pad(date.getHours()) }:${ pad(date.getMinutes()) }`;
		if (sameDay(date, now)) return `Hoje, ${ time }`;
		if (sameDay(date, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return `Ontem, ${ time }`;
		const year = date.getFullYear() === now.getFullYear() ? '' : ` ${ date.getFullYear() }`;
		return `${ pad(date.getDate()) } ${ shortMonth(date) }${ year }, ${ time }`;
	},

	/* "8 novas, 3 conciliadas, 1 atualizada" — só o que não é zero; tudo zero = "nada novo". */
	shortImportSummary: (bank_import: Pick<TBankImport, 'created_count' | 'updated_count' | 'discarded_count' | 'skipped_count'> & Partial<Pick<TBankImport, 'matched_count'>>) => {
		const parts = [
			[ bank_import.created_count, 'nova', 'novas' ],
			[ bank_import.matched_count ?? 0, 'conciliada', 'conciliadas' ],
			[ bank_import.updated_count, 'atualizada', 'atualizadas' ],
			[ bank_import.discarded_count, 'removida', 'removidas' ],
			[ bank_import.skipped_count, 'ignorada', 'ignoradas' ],
		] as const;
		const text = parts.filter(([ count ]) => count > 0).map(([ count, one, many ]) => plural(count, one, many)).join(', ');
		return text || 'nada novo';
	},

	/* "Conta corrente", "Poupança", "Cartão de crédito" (cai no tipo genérico se a Pluggy não mandou o subtipo). */
	subtypeLabel: (link: Pick<TBankAccountLink, 'external_type' | 'external_subtype'>) =>
		(link.external_subtype && SUBTYPE_LABELS[link.external_subtype]) || BankConnectionUtils.linkTypeLabel(link),

	/* "•••• 4821" a partir do número da conta/cartão; `null` sem número. */
	maskedNumber: (number: string | null) => {
		const digits = (number || '').replace(/\D/g, '');
		return digits.length >= 4 ? `•••• ${ digits.slice(-4) }` : (number || null);
	},

	lastSyncLabel: (connection: Pick<TBankConnection, 'last_synced_at'>) =>
		connection.last_synced_at ? `Atualizada em ${ DateUtils.formateTo(connection.last_synced_at, "dd/MM/yyyy 'às' HH:mm") }` : 'Ainda não atualizada',

	linkTypeLabel: (link: Pick<TBankAccountLink, 'external_type'>) => (link.external_type === 'CREDIT' ? 'Cartão de crédito' : 'Conta'),

	linkStatus: (status: TBankAccountLinkStatus) => LINK_STATUS_LABELS[status] || { label: status, tone: 'neutral' as TStatusTone },

	/* "Saldo R$ X" (conta) ou "Limite R$ X" (cartão), a partir do `external_data` em reais. `null` se a Pluggy não mandou. */
	linkAmountLabel: (link: Pick<TBankAccountLink, 'external_type' | 'external_data'>) => {
		if (link.external_type === 'CREDIT') {
			const limit = reaisToMoney(link.external_data?.creditData?.creditLimit);
			return limit ? `Limite ${ limit }` : null;
		}

		const balance = reaisToMoney(link.external_data?.balance);
		return balance ? `Saldo ${ balance }` : null;
	},

	importModeLabel: (mode: TBankImportMode) => IMPORT_MODE_LABELS[mode] || mode,

	importTriggerLabel: (trigger: TBankImportTrigger) => IMPORT_TRIGGER_LABELS[trigger] || trigger,

	importStatus: (status: TBankImportStatus) => IMPORT_STATUS_LABELS[status] || { label: status, tone: 'neutral' as TStatusTone },

	importPeriodLabel: (bank_import: Pick<TBankImport, 'date_from' | 'date_to'>) => {
		if (!bank_import.date_from && !bank_import.date_to) return 'Período não informado';
		const from = bank_import.date_from ? DateUtils.formatDate(bank_import.date_from) : '…';
		const to = bank_import.date_to ? DateUtils.formatDate(bank_import.date_to) : '…';
		return `${ from } a ${ to }`;
	},

	/* "X criadas, Y atualizadas, Z removidas, W ignoradas" de um ou mais lotes. */
	importSummaryMessage: (imports: (Pick<TBankImport, 'created_count' | 'updated_count' | 'discarded_count' | 'skipped_count'> & Partial<Pick<TBankImport, 'matched_count'>>)[]) => {
		const total = imports.reduce(
			(acc, item) => ({
				created: acc.created + item.created_count,
				matched: acc.matched + (item.matched_count ?? 0),
				updated: acc.updated + item.updated_count,
				discarded: acc.discarded + item.discarded_count,
				skipped: acc.skipped + item.skipped_count,
			}),
			{ created: 0, matched: 0, updated: 0, discarded: 0, skipped: 0 },
		);

		return [
			plural(total.created, 'criada', 'criadas'),
			...(total.matched > 0 ? [ plural(total.matched, 'conciliada', 'conciliadas') ] : []),
			plural(total.updated, 'atualizada', 'atualizadas'),
			plural(total.discarded, 'removida', 'removidas'),
			plural(total.skipped, 'ignorada', 'ignoradas'),
		].join(', ');
	},

	/*
	 * Rótulo de um candidato da revisão de conciliação:
	 * - compra parcelada: "Loja · compra em agosto de 2026 · parcelas já recebidas: 1, 2";
	 * - transação: "Netflix · 05/10/2026 · prevista" (ou "lançada à mão" / "do banco").
	 */
	matchCandidateLabel: (candidate: TMatchCandidate) => {
		if (candidate.type === 'recurrence') {
			const [ year, month ] = (candidate.purchase_month || '').split('-').map(Number);
			const month_name = MONTH_NAMES_PT[month - 1]?.toLowerCase();
			const purchase = month_name ? ` · compra em ${ month_name } de ${ year }` : '';
			const known = candidate.known_installments?.length ? candidate.known_installments.join(', ') : 'nenhuma';
			return `${ candidate.description }${ purchase } · parcelas já recebidas: ${ known }`;
		}

		const date = candidate.transaction_date ? ` · ${ DateUtils.formatDate(candidate.transaction_date) }` : '';
		let origin = 'lançada à mão';
		if (candidate.projected) origin = 'prevista';
		else if (candidate.bank_synced) origin = 'do banco';
		return `${ candidate.description }${ date } · ${ origin }`;
	},

	/* "3/10" de uma transação parcelada; `null` se não for parcela. */
	installmentLabel: (transaction: { installment_number: number | null; installment_total: number | null }) =>
		(transaction.installment_number && transaction.installment_total ? `${ transaction.installment_number }/${ transaction.installment_total }` : null),

	/* Período default do "Importar período": últimos 12 meses até hoje (YYYY-MM-DD). */
	defaultImportPeriod: (today: Date = new Date()) => ({
		date_from: toYmd(DateUtils.addMonths(today, -12) || today),
		date_to: toYmd(today),
	}),
};
