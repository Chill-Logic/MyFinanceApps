import { deleteTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateTransactionData } from '@/hooks/api/transactions/invalidateTransactionData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMessageResponse, type TMutationParams } from '@/types';

export const useDeleteTransactions = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, {}>) => {
			const axios = getAxiosInstance();
			return deleteTransaction(axios, id!);
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

export default useDeleteTransactions;
