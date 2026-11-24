import { deleteWallet, QUERY_KEYS, type TMessageResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams } from '@/types';

export const useDeleteWallet = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, undefined>) => {
			const axios = getAxiosInstance();
			return deleteWallet(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useDeleteWallet;
