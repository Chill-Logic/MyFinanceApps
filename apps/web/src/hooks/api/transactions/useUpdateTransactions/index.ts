import { updateTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TListTransactionsResponse, type TMutationParams, type TUpdateTransactionBody } from '@/types';

export const useUpdateTransactions = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TListTransactionsResponse, TUpdateTransactionBody>) => {
			const axios = getAxiosInstance();
			return updateTransaction(axios, id!, body);
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

export default useUpdateTransactions;
