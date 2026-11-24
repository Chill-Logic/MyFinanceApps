import { settleTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateTransactionData } from '@/hooks/api/transactions/invalidateTransactionData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TSettleTransactionBody, type TTransaction } from '@/types';

export const useSettleTransaction = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TSettleTransactionBody>) => {
			const axios = getAxiosInstance();
			return settleTransaction(axios, id!, body);
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

export default useSettleTransaction;
