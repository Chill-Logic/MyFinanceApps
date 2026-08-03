import { updateCreditBalance, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TCreditBalance, type TCreditBalanceBody, type TMutationParams } from '@/types';

export const useUpdateCreditBalance = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TCreditBalance, TCreditBalanceBody>) => {
			const axios = getAxiosInstance();
			return updateCreditBalance(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateCreditBalance;
