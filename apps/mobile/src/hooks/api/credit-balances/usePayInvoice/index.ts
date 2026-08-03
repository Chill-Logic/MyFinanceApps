import { payInvoice, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TPayInvoiceBody } from '../../../../types/api';
import { TTransaction } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const usePayInvoice = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TPayInvoiceBody>) => {
			const axios = await getAxiosInstance();
			return payInvoice(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_balance.get_invoice ] });
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
