import type { TCashProjection } from '../api';
import type { TCurrentInvoice, TTransaction } from '../models';

import { TransactionUtils } from './transaction';

/*
 * Projeção de saldo das contas, dia a dia, calculada no cliente (redesign 2026-11), no formato do contrato
 * `TCashProjection`. É provisória: quando o backend expor `GET /accounts/projection`, quem usa troca
 * `estimateCashProjection` por `getCashProjection` (fetchers/projection.ts). Regras (o backend deve seguir as mesmas):
 *   - parte da SOMA dos saldos efetivados das contas (o "saldo hoje");
 *   - soma, no dia previsto, cada transação de conta ainda não efetivada (pendente ou prevista de
 *     recorrência), fora rascunho; atrasada (data já passou) conta como se acontecesse hoje;
 *   - transferência entre duas contas da carteira não mexe no total;
 *   - cada fatura de cartão em aberto vira uma saída no vencimento, pelo que falta pagar — descontando o
 *     pagamento dela que já estiver lançado como pendente (`paid_credit_balance_id`), pra não contar duas vezes.
 * Datas comparadas por string "YYYY-MM-DD" (sem fuso).
 */

export type TProjectionInvoice = {
	credit_balance_id: string;
	invoice: Pick<TCurrentInvoice, 'due_date' | 'remaining' | 'invoice_month'>;
};

export type TProjectionInput = {
	/* Hoje, "YYYY-MM-DD". */
	today: string;
	/* Quantos dias depois de hoje (7, 30, 90...). */
	days: number;
	/* Contas da carteira com o saldo efetivado de agora. */
	accounts: { id: string; balance: number }[];
	/* Transações de conta dos meses que cobrem o período (as efetivadas são ignoradas). */
	transactions: TTransaction[];
	/* Faturas dos cartões que podem vencer no período. */
	invoices: TProjectionInvoice[];
};

const ymd = (iso: string) => iso.split('T')[0];

const addDays = (date: string, amount: number): string => {
	const [ year, month, day ] = date.split('-').map(Number);
	const next = new Date(year, month - 1, day + amount);
	return `${ next.getFullYear() }-${ String(next.getMonth() + 1).padStart(2, '0') }-${ String(next.getDate()).padStart(2, '0') }`;
};

const endOfMonth = (date: string): string => {
	const [ year, month ] = date.split('-').map(Number);
	const last = new Date(year, month, 0);
	return `${ last.getFullYear() }-${ String(last.getMonth() + 1).padStart(2, '0') }-${ String(last.getDate()).padStart(2, '0') }`;
};

export const ProjectionUtils = {
	addDays,
	endOfMonth,

	build: ({ today, days, accounts, transactions, invoices }: TProjectionInput): TCashProjection => {
		const account_ids = new Set(accounts.map((account) => account.id));
		const start = accounts.reduce((acc, account) => acc + account.balance, 0);
		const last_day = addDays(today, days);

		/* Variação por dia (só dentro do período) e por conta até o fim do mês. */
		const delta_by_day = new Map<string, number>();
		const add = (date: string, value: number) => delta_by_day.set(date, (delta_by_day.get(date) ?? 0) + value);
		const month_end = endOfMonth(today);
		const end_of_month_by_account: Record<string, number> = {};
		accounts.forEach((account) => {
			end_of_month_by_account[account.id] = account.balance;
		});

		const pending = transactions.filter((item) => item.source_type === 'Account' && !item.draft && !item.settled);
		/* Pagamentos de fatura já lançados como pendentes, por cartão (pra não somar a fatura de novo). */
		const pending_payments = new Map<string, number>();

		pending.forEach((item) => {
			const date = ymd(item.transaction_date) < today ? today : ymd(item.transaction_date);
			const direction = TransactionUtils.direction(item, account_ids);
			const signed = { in: item.value, out: -item.value, internal: 0 }[direction];

			if (item.paid_credit_balance_id) {
				pending_payments.set(item.paid_credit_balance_id, (pending_payments.get(item.paid_credit_balance_id) ?? 0) + item.value);
			}
			if (date <= last_day) add(date, signed);

			if (date <= month_end) {
				/* Por conta: a origem perde; numa transferência, o destino da carteira ganha. */
				if (item.kind === 'transfer') {
					if (account_ids.has(item.source_id)) end_of_month_by_account[item.source_id] -= item.value;
					if (item.destination_account_id && account_ids.has(item.destination_account_id)) {
						end_of_month_by_account[item.destination_account_id] += item.value;
					}
				} else if (account_ids.has(item.source_id)) {
					end_of_month_by_account[item.source_id] += item.kind === 'deposit' ? item.value : -item.value;
				}
			}
		});

		invoices.forEach(({ credit_balance_id, invoice }) => {
			const due = ymd(invoice.due_date);
			if (!invoice.remaining || due > last_day) return;
			const already_scheduled = pending_payments.get(credit_balance_id) ?? 0;
			const to_pay = Math.max(0, invoice.remaining - already_scheduled);
			pending_payments.set(credit_balance_id, Math.max(0, already_scheduled - invoice.remaining));
			if (to_pay > 0) add(due < today ? today : due, -to_pay);
		});

		const points: TCashProjection['points'] = [];
		let balance = start;
		for (let offset = 0; offset <= days; offset += 1) {
			const date = addDays(today, offset);
			balance += delta_by_day.get(date) ?? 0;
			points.push({ date, balance });
		}

		const lowest = points.reduce((min, point) => (point.balance < min.balance ? point : min), points[0]);

		return {
			today,
			days,
			start_balance: start,
			end_balance: points[points.length - 1].balance,
			lowest,
			points,
			accounts: accounts.map((account) => ({
				id: account.id,
				balance: account.balance,
				end_of_month_balance: end_of_month_by_account[account.id],
			})),
		};
	},
};

export default ProjectionUtils;
