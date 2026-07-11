import { updateTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TUpdateTransactionBody } from '../../../../types/api';
import { TTransaction } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateTransactions = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TUpdateTransactionBody>) => {
			const axios = await getAxiosInstance();
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
