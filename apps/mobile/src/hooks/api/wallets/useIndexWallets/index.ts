import { useQuery } from '@tanstack/react-query';

import { type TIndexWalletsResponse } from '../../../../types/api';

import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexWalletsProps = {
	enabled?: boolean;
}

export const useIndexWallets = (props?: TUseIndexWalletsProps) => {
	const { enabled = true } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.wallet.get_all ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			const response = await axios.get<TIndexWalletsResponse>('/wallets');
			return response.data;
		},
		enabled,
	});
};
