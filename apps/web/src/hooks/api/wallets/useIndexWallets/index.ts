import { indexWallets, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexWalletsProps = {
	enabled?: boolean;
};

export const useIndexWallets = (props?: TUseIndexWalletsProps) => {
	const { enabled = true } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.wallet.get_all ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexWallets(axios);
		},
		enabled,
	});
};

export default useIndexWallets;
