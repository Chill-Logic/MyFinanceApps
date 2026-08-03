import { QUERY_KEYS, unsettleTransaction } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams } from '../../../../types/api';
import { TTransaction } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUnsettleTransaction = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TTransaction, {}>) => {
			const axios = await getAxiosInstance();
			return unsettleTransaction(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
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
