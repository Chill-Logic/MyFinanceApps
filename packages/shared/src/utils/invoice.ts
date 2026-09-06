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

/* Nome do mês de um "YYYY-MM" ou de uma data ISO, ex "Agosto 2026". */
const monthName = (iso: string): string => {
	const [ year, month ] = ymd(iso);
	return `${ MONTHS_PT[month - 1] } ${ year }`;
};

export const InvoiceUtils = {
	/*
	 * Nome da fatura pelo VENCIMENTO (`due_date`), ex "Agosto 2026" — convenção de cartão: a fatura "de
	 * agosto" é a que VENCE em agosto, não a do ciclo de compras de agosto. Deriva do `due_date`, não da
	 * data de referência que a UI usa pra navegar entre ciclos (essa pode cair num mês diferente do
	 * vencimento).
	 */
	label: (invoice: Pick<TCurrentInvoice, 'due_date'>): string => monthName(invoice.due_date),

	/*
	 * Mesmo nome, a partir do `invoice_month` ("YYYY-MM"). Equivale ao `label`: o `invoice_month` JÁ é o
	 * mês do vencimento do ciclo (é assim que o backend o calcula), então não há deslocamento nenhum a
	 * fazer. Serve pra rotular uma fatura que a UI ainda não carregou.
	 */
	monthLabel: monthName,

	/*
	 * Soma `offset` meses a um `invoice_month` ("YYYY-MM"; aceita data ISO, de que usa só o mês) e
	 * devolve outro "YYYY-MM", pronto pra ir como `reference`. É assim que se navega entre faturas:
	 * andando no MÊS DA FATURA, nunca fazendo conta com as datas do ciclo.
	 */
	shiftMonth: (invoiceMonth: string, offset: number): string => {
		const [ year, month ] = ymd(invoiceMonth);
		const date = new Date(year, (month - 1) + offset, 1);
		return `${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }`;
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
