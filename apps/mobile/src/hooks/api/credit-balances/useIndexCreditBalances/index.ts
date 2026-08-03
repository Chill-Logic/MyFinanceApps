import { indexCreditBalances, QUERY_KEYS, TIndexCreditBalancesParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexCreditBalancesProps = {
	enabled?: boolean;
	params?: TIndexCreditBalancesParams;
}

export const useIndexCreditBalances = (props?: TUseIndexCreditBalancesProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.credit_balance.get_all, params?.wallet_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexCreditBalances(axios, params);
		},
		enabled,
	});
};
