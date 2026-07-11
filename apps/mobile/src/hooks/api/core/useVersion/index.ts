import { getVersion } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useVersion = () => {
	return useQuery({
		queryKey: [ 'core-version' ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return getVersion(axios);
		},
		staleTime: 1000 * 60 * 60,
	});
};
