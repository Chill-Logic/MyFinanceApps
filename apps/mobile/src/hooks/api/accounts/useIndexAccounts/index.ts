import { indexAccounts, QUERY_KEYS, TIndexAccountsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexAccountsProps = {
	enabled?: boolean;
	params?: TIndexAccountsParams;
}

export const useIndexAccounts = (props?: TUseIndexAccountsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.account.get_all, params?.wallet_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexAccounts(axios, params);
		},
		enabled,
	});
};
