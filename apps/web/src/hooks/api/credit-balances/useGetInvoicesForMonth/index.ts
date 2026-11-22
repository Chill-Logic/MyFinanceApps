import { getInvoice, QUERY_KEYS, type TCurrentInvoice } from '@myfinance/shared';
import { keepPreviousData, useQueries } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseGetInvoicesForMonthProps = {
	/* Ids dos créditos (`CreditBalance`) cuja fatura buscar. */
	ids: string[];
	/* Mês da fatura (`YYYY-MM`), o mesmo bucket do grupo `credits` do index de transações. */
	reference: string;
	enabled?: boolean;
};

/*
 * Fatura de um mês para vários cartões de uma vez (uma query por cartão, com a mesma chave do
 * `useGetInvoice` — o cache é compartilhado com ele). Devolve um Map id → fatura (ausente enquanto carrega).
 *
 * Por que não somar as transações do grupo `credits`: ele inclui o PAGAMENTO da fatura (um `deposit` no
 * cartão), então o líquido de uma fatura paga dá zero. O `amount` da fatura é o total das compras.
 */
export const useGetInvoicesForMonth = ({ ids, reference, enabled = true }: TUseGetInvoicesForMonthProps) => {
	const results = useQueries({
		queries: ids.map((id) => ({
			queryKey: [ QUERY_KEYS.credit_balance.get_invoice, id, reference, undefined ],
			queryFn: async() => {
				const axios = getAxiosInstance();
				return getInvoice(axios, id, { reference });
			},
			placeholderData: keepPreviousData,
			enabled,
		})),
	});

	const invoices = new Map<string, TCurrentInvoice>();
	results.forEach((result, index) => {
		if (result.data) invoices.set(ids[index], result.data);
	});

	return {
		invoices,
		is_loading: results.some((result) => result.isLoading),
	};
};

export default useGetInvoicesForMonth;
