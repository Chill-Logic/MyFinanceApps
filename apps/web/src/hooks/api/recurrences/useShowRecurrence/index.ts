import { QUERY_KEYS, showRecurrence } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

export const useShowRecurrence = (id?: string | null) => {
	return useQuery({
		queryKey: [ QUERY_KEYS.recurrence.get_one, id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return showRecurrence(axios, id!);
		},
		enabled: Boolean(id),
	});
};

export default useShowRecurrence;
