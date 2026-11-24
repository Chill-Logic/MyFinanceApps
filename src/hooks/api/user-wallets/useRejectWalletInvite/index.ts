import { QUERY_KEYS, rejectWalletInvite, type TMessageResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams } from '@/types';

export const useRejectWalletInvite = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, undefined>) => {
			const axios = getAxiosInstance();
			return rejectWalletInvite(axios, id!);
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

export default useRejectWalletInvite;
