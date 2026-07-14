import { updateAccount, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TAccount, type TAccountBody, type TMutationParams } from '@/types';

export const useUpdateAccount = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TAccount, TAccountBody>) => {
			const axios = getAxiosInstance();
			return updateAccount(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateAccount;
