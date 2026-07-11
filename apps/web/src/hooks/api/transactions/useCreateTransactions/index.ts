import { createTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TCreateTransactionBody, type TMutationParams, type TTransaction } from '@/types';

export const useCreateTransactions = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TTransaction, TCreateTransactionBody>) => {
			const axios = getAxiosInstance();
			return createTransaction(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.transaction.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useCreateTransactions;
