import { createTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TListTransactionsResponse, TCreateTransactionBody } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateTransactions = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TListTransactionsResponse, TCreateTransactionBody>) => {
			const axios = await getAxiosInstance();
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
