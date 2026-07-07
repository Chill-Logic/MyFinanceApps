import { getCurrentUser, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

interface IProps {
	enabled?: boolean;
}

const useShowCurrentUser = (props?: IProps) => {
	const { enabled = true } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.user.get_current ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return getCurrentUser(axios);
		},
		enabled,
	});
};

export default useShowCurrentUser;
