import { deleteTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TListTransactionsResponse, type TMutationParams, type TTransaction } from '@/types';

export const useDeleteTransactions = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TListTransactionsResponse, TTransaction>) => {
			const axios = getAxiosInstance();
			return deleteTransaction(axios, id!);
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

export default useDeleteTransactions;
