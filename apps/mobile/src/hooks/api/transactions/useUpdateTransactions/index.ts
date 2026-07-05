import { useMutation } from '@tanstack/react-query';

import { TMutationParams, TListTransactionsResponse, TUpdateTransactionBody } from '../../../../types/api';

import { queryClient } from '../../../../../App';
import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateTransactions = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TListTransactionsResponse, TUpdateTransactionBody>) => {
			const axios = await getAxiosInstance();
			const response = await axios.patch<TListTransactionsResponse>(`/transactions/${ id }`, body);
			return response.data;
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
