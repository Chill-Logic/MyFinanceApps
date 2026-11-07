import { format, parseISO, subDays } from 'date-fns';

import type { TRecurrence, TRecurrenceFrequency, TTransaction } from '../models';

/* Opções de "Repetir" do formulário de transação (a parcelada só existe em cartão). */
export type TRepeatMode = 'none' | 'recurring' | 'installment';

export const RECURRENCE_FREQUENCY_OPTIONS: { value: TRecurrenceFrequency; label: string }[] = [
	{ value: 'monthly', label: 'Mensal' },
	{ value: 'weekly', label: 'Semanal' },
	{ value: 'yearly', label: 'Anual' },
];

const UNIT: Record<TRecurrenceFrequency, [string, string]> = {
	weekly: [ 'semana', 'semanas' ],
	monthly: [ 'mês', 'meses' ],
	yearly: [ 'ano', 'anos' ],
};

const TRAILING_INSTALLMENT = /\s*\(?\s*\d+\s*\/\s*\d+\s*\)?\s*$/;

export const RecurrenceUtils = {
	/* "Mensal", "A cada 2 semanas", "Anual"... */
	frequencyLabel: (recurrence: Pick<TRecurrence, 'frequency' | 'interval'>) => {
		if (recurrence.interval <= 1) {
			return RECURRENCE_FREQUENCY_OPTIONS.find((option) => option.value === recurrence.frequency)?.label || recurrence.frequency;
		}
		return `A cada ${ recurrence.interval } ${ UNIT[recurrence.frequency][1] }`;
	},

	/*
	 * Resumo da regra pra lista: "Mensal · até 10/2027", "Mensal · 12 vezes", "10 parcelas". Valor estimado
	 * ganha "· valor varia".
	 */
	ruleLabel: (recurrence: Pick<TRecurrence, 'recurrence_type' | 'frequency' | 'interval' | 'end_date' | 'occurrences_total' | 'value_mode'>) => {
		if (recurrence.recurrence_type === 'installment') return `${ recurrence.occurrences_total ?? '?' } parcelas`;

		const parts = [ RecurrenceUtils.frequencyLabel(recurrence) ];
		if (recurrence.occurrences_total) parts.push(`${ recurrence.occurrences_total } vezes`);
		else if (recurrence.end_date) parts.push(`até ${ format(parseISO(recurrence.end_date), 'MM/yyyy') }`);
		if (recurrence.value_mode === 'estimated') parts.push('valor varia');
		return parts.join(' · ');
	},

	/* "Televisão (3/10)" → "Televisão" — a descrição de uma compra parcelada não leva o número da parcela. */
	stripInstallmentSuffix: (description: string) => description.replace(TRAILING_INSTALLMENT, '').trim(),

	/* YYYY-MM-DD local de uma data (sem passar por UTC, pra não deslocar o dia). */
	toYmd: (date: Date) => format(date, 'yyyy-MM-dd'),

	/* YYYY-MM-DD do dia da transação (data local), a âncora do "esta e as próximas". */
	occurrenceDate: (transaction: Pick<TTransaction, 'transaction_date'>) => format(parseISO(transaction.transaction_date), 'yyyy-MM-dd'),

	/* Véspera de um YYYY-MM-DD — o `end_date` que encerra a recorrência antes de uma ocorrência. */
	dayBefore: (ymd: string) => format(subDays(parseISO(ymd), 1), 'yyyy-MM-dd'),

	/* Ocorrência de recorrência comum (não parcela): é onde existe "só esta / esta e as próximas". */
	isRecurringOccurrence: (transaction: Pick<TTransaction, 'recurrence_id' | 'recurrence_type'>) =>
		Boolean(transaction.recurrence_id) && transaction.recurrence_type === 'recurring',

	isInstallmentOccurrence: (transaction: Pick<TTransaction, 'recurrence_id' | 'recurrence_type'>) =>
		Boolean(transaction.recurrence_id) && transaction.recurrence_type === 'installment',
};
