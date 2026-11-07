import { indexPendingMatches, QUERY_KEYS, TIndexPendingMatchesParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexPendingMatchesProps = {
	enabled?: boolean;
	params?: TIndexPendingMatchesParams;
}

export const useIndexPendingMatches = (props?: TUseIndexPendingMatchesProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_pending_matches, params?.wallet_id, params?.source_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexPendingMatches(axios, params);
		},
		enabled,
	});
};
