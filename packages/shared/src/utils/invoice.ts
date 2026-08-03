import type { TCurrentInvoice } from '../models';

const MONTHS_PT = [
	'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
	'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/* "2026-09-10" ou "2026-09-10T00:00:00-03:00" → [ano, mês(1-12), dia], só por string (sem tz shift). */
const ymd = (iso: string): [number, number, number] => {
	const [ year, month, day ] = iso.split('T')[0].split('-').map(Number);
	return [ year, month, day ];
};

const toYmdString = (date: Date): string =>
	`${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }-${ String(date.getDate()).padStart(2, '0') }`;

export const InvoiceUtils = {
	/*
	 * Nome da fatura pelo VENCIMENTO (`due_date`), ex "Agosto 2026" — convenção de cartão: a fatura "de
	 * agosto" é a que VENCE em agosto, não a do ciclo de compras de agosto. Deriva do `due_date`, não da
	 * data de referência que a UI usa pra navegar entre ciclos (essa pode cair num mês diferente do
	 * vencimento).
	 */
	label: (invoice: Pick<TCurrentInvoice, 'due_date'>): string => {
		const [ year, month ] = ymd(invoice.due_date);
		return `${ MONTHS_PT[month - 1] } ${ year }`;
	},

	/*
	 * Fatura atual = hoje dentro de `[cycle_start, cycle_end]`, FECHADO dos dois lados. Comparação por
	 * string `YYYY-MM-DD` (largura fixa → ordena lexicograficamente) pra não deslocar por fuso. NÃO é o
	 * mesmo que "offset 0 de navegação": é o ciclo que de fato contém a data de hoje.
	 */
	isCurrent: (invoice: Pick<TCurrentInvoice, 'cycle_start' | 'cycle_end'>, today: Date = new Date()): boolean => {
		const start = invoice.cycle_start.split('T')[0];
		const end = invoice.cycle_end.split('T')[0];
		const reference = toYmdString(today);
		return reference >= start && reference <= end;
	},
};
