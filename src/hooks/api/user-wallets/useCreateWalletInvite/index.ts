import { createWalletInvite, QUERY_KEYS, type TMessageResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TUserWalletInviteBody } from '@/types';

export const useCreateWalletInvite = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TMessageResponse, TUserWalletInviteBody>) => {
			const axios = getAxiosInstance();
			return createWalletInvite(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.invite.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useCreateWalletInvite;
