import { useQuery } from '@tanstack/react-query';

import { TGetMainWalletResponse } from '../../../../types/api';

import { QUERY_KEYS } from '../../../../constants/QueryKeys';
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
			const response = await axios.get<TGetMainWalletResponse>('/wallets/main');
			return response.data;
		},
		enabled,
	});
};
