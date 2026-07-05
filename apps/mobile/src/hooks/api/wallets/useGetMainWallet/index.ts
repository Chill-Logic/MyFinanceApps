import { getMainWallet, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseGetMainWalletParams = {
	enabled?: boolean;
	params?: {
		user_id: string;
	};
}

export const useGetMainWallet = ({ enabled = false, params }: TUseGetMainWalletParams) => {
	return useQuery({
		queryKey: [ QUERY_KEYS.wallet.get_main, params?.user_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return getMainWallet(axios);
		},
		enabled,
	});
};
