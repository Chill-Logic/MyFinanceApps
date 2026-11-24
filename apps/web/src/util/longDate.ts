import { MONTH_NAMES_PT } from '@myfinance/shared';

/* "2026-12-24" (ou ISO completo) → "24 de dezembro de 2026", sem passar por fuso. */
export const longDate = (value: string) => {
	const [ year, month, day ] = value.slice(0, 10).split('-').map(Number);
	if (!year || !month || !day) return value;
	return `${ day } de ${ MONTH_NAMES_PT[month - 1].toLowerCase() } de ${ year }`;
};

/* Hoje + `days` dias, em YYYY-MM-DD (data local). */
export const daysFromToday = (days: number) => {
	const date = new Date();
	date.setDate(date.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${ date.getFullYear() }-${ pad(date.getMonth() + 1) }-${ pad(date.getDate()) }`;
};
