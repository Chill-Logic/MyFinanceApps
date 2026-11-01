import type {
	TBankAccountLink,
	TInstallmentCandidate,
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

export const BANK_AUTO_SYNC_HELP = 'A rotina traz o que é novo e atualiza o que você não editou; o que você editou ou excluiu fica como está.';

export const PROJECTED_INSTALLMENT_HELP = 'O banco ainda não lançou; será substituída quando chegar.';

export const BANK_BEST_PURCHASE_DAY_HELP = (suggested: number | null) => (suggested
	? `O banco não informa o fechamento deste cartão. Pela última fatura, o melhor dia de compra é o dia ${ suggested }.`
	: 'O banco não informa o fechamento deste cartão. Informe o melhor dia de compra.');

export const BANK_IMPORT_RETENTION_HELP = 'A Pluggy guarda até 12 meses de histórico.';

/* `external_data` vem em REAIS (float) — converte pra centavos antes de formatar. */
const reaisToMoney = (value?: number) => (value === undefined || value === null ? null : MoneyUtils.formatMoney(Math.round(value * 100)));

const toYmd = (date: Date) => DateUtils.formateTo(date, 'yyyy-MM-dd');

const plural = (count: number, singular: string, plural_form: string) => `${ count } ${ count === 1 ? singular : plural_form }`;

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
	importSummaryMessage: (imports: Pick<TBankImport, 'created_count' | 'updated_count' | 'discarded_count' | 'skipped_count'>[]) => {
		const total = imports.reduce(
			(acc, item) => ({
				created: acc.created + item.created_count,
				updated: acc.updated + item.updated_count,
				discarded: acc.discarded + item.discarded_count,
				skipped: acc.skipped + item.skipped_count,
			}),
			{ created: 0, updated: 0, discarded: 0, skipped: 0 },
		);

		return [
			plural(total.created, 'criada', 'criadas'),
			plural(total.updated, 'atualizada', 'atualizadas'),
			plural(total.discarded, 'removida', 'removidas'),
			plural(total.skipped, 'ignorada', 'ignoradas'),
		].join(', ');
	},

	/* "Loja · compra em agosto de 2026 · parcelas já recebidas: 1, 2" (opção da revisão de parcela). */
	installmentCandidateLabel: (candidate: Pick<TInstallmentCandidate, 'description' | 'purchase_month' | 'known_installments'>) => {
		const [ year, month ] = candidate.purchase_month.split('-').map(Number);
		const month_name = MONTH_NAMES_PT[month - 1]?.toLowerCase();
		const purchase = month_name ? ` · compra em ${ month_name } de ${ year }` : '';
		const known = candidate.known_installments.length > 0 ? candidate.known_installments.join(', ') : 'nenhuma';
		return `${ candidate.description }${ purchase } · parcelas já recebidas: ${ known }`;
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
