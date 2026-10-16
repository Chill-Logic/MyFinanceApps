import { listWalletMembers, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseListWalletMembersProps = {
	enabled?: boolean;
	params?: {
		wallet_id: string;
	};
}

export const useListWalletMembers = (props?: TUseListWalletMembersProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.wallet.get_members, params?.wallet_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return listWalletMembers(axios, params?.wallet_id || '');
		},
		enabled: enabled && Boolean(params?.wallet_id),
	});
};
