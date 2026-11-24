import { listInvites, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseListInvitesProps = {
	enabled?: boolean;
};

export const useListInvites = (props?: TUseListInvitesProps) => {
	const { enabled = true } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.invite.get_all ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return listInvites(axios, { per_page: 100 });
		},
		enabled,
	});
};

export default useListInvites;
