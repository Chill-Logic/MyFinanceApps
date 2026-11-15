import { indexRecurrences, QUERY_KEYS, type TIndexRecurrencesParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexRecurrencesProps = {
	enabled?: boolean;
	params?: TIndexRecurrencesParams;
};

export const useIndexRecurrences = (props?: TUseIndexRecurrencesProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.recurrence.get_all, params?.wallet_id, params?.recurrence_type, params?.source_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexRecurrences(axios, params);
		},
		enabled,
	});
};

export default useIndexRecurrences;
