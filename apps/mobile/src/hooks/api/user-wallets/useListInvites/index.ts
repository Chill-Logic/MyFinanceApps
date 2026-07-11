import { listInvites, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useListInvites = () => {
	return useQuery({
		queryKey: [ QUERY_KEYS.invite.get_all ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return listInvites(axios, { per_page: 100 });
		},
	});
};
