import { indexPendingMatches, QUERY_KEYS, type TIndexPendingMatchesParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexPendingMatchesProps = {
	enabled?: boolean;
	params?: TIndexPendingMatchesParams;
};

export const useIndexPendingMatches = (props?: TUseIndexPendingMatchesProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_pending_matches, params?.wallet_id, params?.source_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexPendingMatches(axios, params);
		},
		enabled,
	});
};

export default useIndexPendingMatches;
