import { indexBankConnections, QUERY_KEYS, type TIndexBankConnectionsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexBankConnectionsProps = {
	enabled?: boolean;
	params?: TIndexBankConnectionsParams;
};

export const useIndexBankConnections = (props?: TUseIndexBankConnectionsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.bank_connection.get_all, params?.wallet_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexBankConnections(axios, params);
		},
		enabled,
	});
};

export default useIndexBankConnections;
