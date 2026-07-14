import { payInvoice, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TPayInvoiceBody, type TTransaction } from '@/types';

export const usePayInvoice = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TPayInvoiceBody>) => {
			const axios = getAxiosInstance();
			return payInvoice(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			// Pagar fatura mexe em: fatura (paga), saldo da conta pagadora, transações e saldo da carteira
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.transaction.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default usePayInvoice;
