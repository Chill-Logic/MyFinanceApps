import { settleTransaction, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TSettleTransactionBody, type TTransaction } from '@/types';

export const useSettleTransaction = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TSettleTransactionBody>) => {
			const axios = getAxiosInstance();
			return settleTransaction(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			// Efetivar move o valor pro saldo efetivado (conta/carteira) e altera os totais do mês
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.transaction.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useSettleTransaction;
