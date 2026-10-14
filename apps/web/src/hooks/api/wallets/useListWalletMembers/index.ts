import { listWalletMembers, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseListWalletMembersProps = {
	enabled?: boolean;
	wallet_id?: string;
};

export const useListWalletMembers = (props?: TUseListWalletMembersProps) => {
	const { enabled = true, wallet_id } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.wallet.get_members, wallet_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return listWalletMembers(axios, wallet_id || '');
		},
		enabled: enabled && Boolean(wallet_id),
	});
};

export default useListWalletMembers;
