import { useQuery } from '@tanstack/react-query';

import { TUser } from '../../../../types/models';

import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

const useShowCurrentUser = () => {
	return useQuery({
		queryKey: [ QUERY_KEYS.user.get_current ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			const response = await axios.get<TUser>('/users/me');
			return response.data;
		},
	});
};

export default useShowCurrentUser;
