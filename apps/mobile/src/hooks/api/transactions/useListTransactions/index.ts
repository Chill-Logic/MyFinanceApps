import { listTransactions, QUERY_KEYS, type TListTransactionsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseListTransactionsProps = {
	enabled?: boolean;
	params?: TListTransactionsParams;
}

export const useListTransactions = (props?: TUseListTransactionsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_all, params?.wallet_id, params?.start_date, params?.end_date ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return listTransactions(axios, params);
		},
		enabled,
	});
};
