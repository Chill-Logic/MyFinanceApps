import { createCreditBalance, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TCreditBalanceBody, TMutationParams } from '../../../../types/api';
import { TCreditBalance } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateCreditBalance = () => {
	return useMutation({
		mutationFn: async({ body, wallet_id }: TMutationParams<TCreditBalance, TCreditBalanceBody, { wallet_id: string }>) => {
			const axios = await getAxiosInstance();
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
