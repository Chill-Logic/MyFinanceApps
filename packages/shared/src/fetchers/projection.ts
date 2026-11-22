import type { AxiosInstance } from 'axios';

import { TCashProjection, TCashProjectionParams } from '../api';
import { API_ROUTES } from '../routes';
import { ProjectionUtils, TProjectionInvoice } from '../utils/projection';
import { indexAccounts } from './accounts';
import { getInvoice, indexCreditBalances } from './creditBalances';
import { listTransactions } from './transactions';

/*
 * Saldo projetado das contas. `getCashProjection` é o fetcher definitivo, do endpoint que o backend ainda
 * vai implementar (`GET /accounts/projection`). Enquanto ele não existe, os apps usam `estimateCashProjection`,
 * que devolve a MESMA resposta montada a partir dos endpoints de hoje — a troca é uma linha no hook.
 */
export const getCashProjection = async(axios: AxiosInstance, params: TCashProjectionParams): Promise<TCashProjection> => {
	const response = await axios.get<{ data: TCashProjection }>(API_ROUTES.accounts.projection, { params });
	return response.data.data;
};

const toYmd = (date: Date) => `${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }-${ String(date.getDate()).padStart(2, '0') }`;

/* Meses ("YYYY-MM") de `from` até `to`, inclusive. */
const monthsBetween = (from: string, to: string): string[] => {
	const months: string[] = [];
	let [ year, month ] = from.split('-').map(Number);
	const [ to_year, to_month ] = to.split('-').map(Number);
	while (year < to_year || (year === to_year && month <= to_month)) {
		months.push(`${ year }-${ String(month).padStart(2, '0') }`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return months;
};

/* Provisório: contas + transações dos meses do período + faturas que vencem neles → `ProjectionUtils.build`. */
export const estimateCashProjection = async(axios: AxiosInstance, { wallet_id, days }: TCashProjectionParams): Promise<TCashProjection> => {
	const today = toYmd(new Date());
	const months = monthsBetween(today, ProjectionUtils.addDays(today, days));

	const [ accounts_response, credits_response, ...month_groups ] = await Promise.all([
		indexAccounts(axios, { wallet_id, per_page: 100 }),
		indexCreditBalances(axios, { wallet_id, per_page: 100 }),
		...months.map((reference) => listTransactions(axios, { wallet_id, reference })),
	]);

	const credit_balances = credits_response.data;
	const invoice_pairs = credit_balances.flatMap((credit_balance) => months.map((reference) => ({ id: credit_balance.id, reference })));
	const invoices: TProjectionInvoice[] = await Promise.all(invoice_pairs.map(async({ id, reference }) => ({
		credit_balance_id: id,
		invoice: await getInvoice(axios, id, { reference }),
	})));

	return ProjectionUtils.build({
		today,
		days,
		accounts: accounts_response.data,
		transactions: month_groups.flatMap((group) => group.accounts.data),
		invoices,
	});
};
