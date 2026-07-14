import { indexAccounts, QUERY_KEYS, type TIndexAccountsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexAccountsProps = {
	enabled?: boolean;
	params?: TIndexAccountsParams;
};

export const useIndexAccounts = (props?: TUseIndexAccountsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.account.get_all, params?.wallet_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexAccounts(axios, params);
		},
		enabled,
	});
};

export default useIndexAccounts;
