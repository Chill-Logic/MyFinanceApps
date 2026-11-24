import type { TBankAccountLink } from '@myfinance/shared';

/* Peças visuais da aba Bancos e de "Contas do banco" (redesign 2026-11). */

export const STATUS_DOT = {
	success: 'bg-success',
	warning: 'bg-warning-dot',
	error: 'bg-destructive',
	info: 'bg-info',
	neutral: 'bg-muted-foreground',
} as const;

export const STATUS_TEXT = {
	success: 'text-success',
	warning: 'text-warning',
	error: 'text-destructive',
	info: 'text-info',
	neutral: 'text-muted-foreground',
} as const;

export const STATUS_NOTE = {
	success: 'bg-success-soft text-success',
	warning: 'bg-warning-soft text-warning',
	error: 'bg-danger-soft text-destructive',
	info: 'bg-info-soft text-foreground',
	neutral: 'bg-secondary text-muted-foreground',
} as const;

export const plural = (count: number, one: string, many: string) => `${ count } ${ count === 1 ? one : many }`;

/* Resumo dos vínculos de uma conexão (contagens, última importação, sincronização automática). */
export const summarizeLinks = (links: TBankAccountLink[]) => {
	const linked = links.filter((link) => link.status === 'linked');
	const pending = links.filter((link) => link.status === 'pending');
	const ignored = links.filter((link) => link.status === 'ignored');
	const auto = linked.filter((link) => link.auto_sync);
	const last_import = links
		.map((link) => link.last_import)
		.filter(Boolean)
		.sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime())[0] ?? null;

	return { linked, pending, ignored, auto, last_import };
};
