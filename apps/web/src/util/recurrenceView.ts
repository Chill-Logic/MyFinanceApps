import { MONTH_NAMES_PT, MoneyUtils, RecurrenceUtils, type TRecurrence } from '@myfinance/shared';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';

/* Helpers da aba Recorrências e do diálogo de edição (redesign 2026-11). Datas "YYYY-MM-DD" lidas como string (sem fuso). */

export const plainMoney = (value: number) => MoneyUtils.formatMoney(Math.abs(value)).replace(/^R\$\s?/, '');
export const splitCents = (formatted: string) => {
	const comma = formatted.lastIndexOf(',');
	return comma === -1 ? [ formatted, '' ] : [ formatted.slice(0, comma), formatted.slice(comma) ];
};

/* Datas "YYYY-MM-DD" lidas como string (sem fuso). */
export const ymdParts = (ymd: string) => ymd.split('T')[0].split('-').map(Number);
export const monthShort = (month: number) => MONTH_NAMES_PT[month - 1]?.slice(0, 3).toLowerCase() ?? '';
export const dayMonth = (ymd: string) => {
	const [ , month, day ] = ymdParts(ymd);
	return `${ day } ${ monthShort(month) }`;
};
export const monthYear = (year: number, month: number) => `${ monthShort(month) } ${ year }`;
/* Mês (ano, mês) de `ymd` somado a `months`. */
export const addMonths = (ymd: string, months: number) => {
	const [ year, month ] = ymdParts(ymd);
	const total = year * 12 + (month - 1) + months;
	return [ Math.floor(total / 12), (total % 12) + 1 ];
};
export const monthsBetween = (from: string, to: string) => {
	const [ from_year, from_month ] = ymdParts(from);
	const [ to_year, to_month ] = ymdParts(to);
	return (to_year - from_year) * 12 + (to_month - from_month);
};

export const isEnded = (recurrence: TRecurrence) => !recurrence.next_occurrence;
export const isEstimated = (recurrence: TRecurrence) => recurrence.value_mode === 'estimated';

/* "todo mês, dia 5" / "todo ano, 12 jan" / "a cada 2 semanas" — a regra em palavras, pra tabela. */
export const ruleText = (recurrence: TRecurrence) => {
	const [ , month, day ] = ymdParts(recurrence.start_date);
	if (recurrence.interval > 1) return RecurrenceUtils.frequencyLabel(recurrence).toLowerCase();
	if (recurrence.frequency === 'monthly') return `todo mês, dia ${ day }`;
	if (recurrence.frequency === 'yearly') return `todo ano, ${ day } ${ monthShort(month) }`;
	return 'toda semana';
};

/*
 * Progresso de uma compra parcelada. "Pagas" = parcelas antes da próxima prevista (a próxima é a de hoje em
 * diante); sem próxima, todas. O que falta pagar desconta a 1ª parcela, que leva os centavos da divisão.
 */
export const installmentProgress = (recurrence: TRecurrence) => {
	const total_count = recurrence.occurrences_total ?? 0;
	const next = recurrence.next_occurrence;
	const done = next ? Math.min(total_count, Math.max(0, monthsBetween(recurrence.start_date, next.transaction_date))) : total_count;
	const total_value = recurrence.total_value ?? recurrence.value * total_count;
	const first_extra = Math.max(0, total_value - recurrence.value * total_count);
	const paid = done > 0 ? done * recurrence.value + first_extra : 0;
	const [ end_year, end_month ] = addMonths(recurrence.start_date, Math.max(0, total_count - 1));
	return {
		done,
		total_count,
		left: Math.max(0, total_count - done),
		remaining: Math.max(0, total_value - paid),
		total_value,
		first_value: recurrence.value + first_extra,
		has_extra: first_extra > 0,
		end_key: end_year * 12 + end_month,
		end_label: monthYear(end_year, end_month),
	};
};

/* Ícone e cor por tipo: entrada verde, saída neutra, transferência azul. */
export const KIND_VISUAL = {
	deposit: { icon: ArrowDownLeft, tile: 'bg-success-soft text-success', value: 'text-success', sign: '+' },
	withdraw: { icon: ArrowUpRight, tile: 'bg-secondary text-foreground', value: 'text-foreground', sign: '−' },
	transfer: { icon: ArrowLeftRight, tile: 'bg-info-soft text-info', value: 'text-info', sign: '' },
} as const;

export const KIND_WORD = { deposit: 'Entrada', withdraw: 'Saída', transfer: 'Transferência' } as const;

/* "≈ −2.200,00": sinal pelo tipo e "≈" quando o valor é estimado. */
export const valueText = (recurrence: TRecurrence) => {
	const visual = KIND_VISUAL[recurrence.kind];
	return `${ isEstimated(recurrence) ? '≈ ' : '' }${ visual.sign }${ plainMoney(recurrence.value) }`;
};
