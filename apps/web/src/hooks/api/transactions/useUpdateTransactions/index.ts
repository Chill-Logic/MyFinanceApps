import { updateTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateTransactionData } from '@/hooks/api/transactions/invalidateTransactionData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TTransaction, type TUpdateTransactionBody } from '@/types';

export const useUpdateTransactions = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TUpdateTransactionBody>) => {
			const axios = getAxiosInstance();
			return updateTransaction(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			invalidateTransactionData();
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateTransactions;
