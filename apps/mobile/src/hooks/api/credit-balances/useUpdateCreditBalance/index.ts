import { QUERY_KEYS, updateCreditBalance } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TCreditBalanceBody, TMutationParams } from '../../../../types/api';
import { TCreditBalance } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateCreditBalance = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TCreditBalance, TCreditBalanceBody>) => {
			const axios = await getAxiosInstance();
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
