import { createTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateTransactionData } from '@/hooks/api/transactions/invalidateTransactionData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TCreateTransactionBody, type TMutationParams, type TTransaction } from '@/types';

export const useCreateTransactions = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TTransaction, TCreateTransactionBody>) => {
			const axios = getAxiosInstance();
			return createTransaction(axios, body);
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

export default useCreateTransactions;
