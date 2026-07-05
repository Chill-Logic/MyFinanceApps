import { getCurrentUser, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

const useShowCurrentUser = () => {
	return useQuery({
		queryKey: [ QUERY_KEYS.user.get_current ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return getCurrentUser(axios);
		},
	});
};

export default useShowCurrentUser;
