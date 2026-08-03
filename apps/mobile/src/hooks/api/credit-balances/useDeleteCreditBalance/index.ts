import { deleteCreditBalance, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMessageResponse, TMutationParams } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useDeleteCreditBalance = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, {}>) => {
			const axios = await getAxiosInstance();
			return deleteCreditBalance(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_card.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.transaction.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
