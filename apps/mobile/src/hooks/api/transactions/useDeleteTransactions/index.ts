import { deleteTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMutationParams, TListTransactionsResponse } from '../../../../types/api';
import { TTransaction } from '../../../../types/models';

import { queryClient } from '../../../../../App';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useDeleteTransactions = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TListTransactionsResponse, TTransaction>) => {
			const axios = await getAxiosInstance();
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
