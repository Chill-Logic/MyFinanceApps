import { unsettleTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateTransactionData } from '@/hooks/api/transactions/invalidateTransactionData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TTransaction } from '@/types';

export const useUnsettleTransaction = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TTransaction, {}>) => {
			const axios = getAxiosInstance();
			return unsettleTransaction(axios, id!);
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

export default useUnsettleTransaction;
