import { createCreditBalance, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TCreditBalance, type TCreditBalanceBody, type TMutationParams } from '@/types';

export const useCreateCreditBalance = () => {
	return useMutation({
		mutationFn: async({ body, wallet_id }: TMutationParams<TCreditBalance, TCreditBalanceBody, { wallet_id: string }>) => {
			const axios = getAxiosInstance();
			return createCreditBalance(axios, wallet_id, body);
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

export default useCreateCreditBalance;
