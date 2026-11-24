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
			// Mudar o melhor dia de compra/vencimento muda o ciclo, e com ele a fatura de cada mês.
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_invoice ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_projection ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateCreditBalance;
