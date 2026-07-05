import { useQuery } from '@tanstack/react-query';

import { type TListInvitesResponse } from '../../../../types/api';

import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useListInvites = () => {
	return useQuery({
		queryKey: [ QUERY_KEYS.invite.get_all ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			const response = await axios.get<TListInvitesResponse>('/user-wallets');
			return response.data;
		},
	});
};
