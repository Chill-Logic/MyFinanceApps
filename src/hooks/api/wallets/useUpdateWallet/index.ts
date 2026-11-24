import { updateWallet, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TWallet, type TWalletBody } from '@/types';

export const useUpdateWallet = () => {
	return useMutation({
		mutationFn: async({ id, body }: TMutationParams<TWallet, TWalletBody>) => {
			const axios = getAxiosInstance();
			return updateWallet(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateWallet;
