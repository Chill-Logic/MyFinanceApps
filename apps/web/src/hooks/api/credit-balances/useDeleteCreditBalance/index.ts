import { deleteCreditBalance, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMessageResponse, type TMutationParams } from '@/types';

export const useDeleteCreditBalance = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, {}>) => {
			const axios = getAxiosInstance();
			return deleteCreditBalance(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			// Sem o cartão, a fatura dele sai das somas de "Faturas do mês".
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_invoice ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_projection ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_card.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.transaction.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useDeleteCreditBalance;
