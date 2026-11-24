import { indexCreditBalances, QUERY_KEYS, type TIndexCreditBalancesParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexCreditBalancesProps = {
	enabled?: boolean;
	params?: TIndexCreditBalancesParams;
};

export const useIndexCreditBalances = (props?: TUseIndexCreditBalancesProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.credit_balance.get_all, params?.wallet_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexCreditBalances(axios, params);
		},
		enabled,
	});
};

export default useIndexCreditBalances;
