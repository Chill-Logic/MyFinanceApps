import { QUERY_KEYS, updateAccount } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TAccountBody, TMutationParams } from '../../../../types/api';
import { TAccount } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateAccount = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TAccount, TAccountBody>) => {
			const axios = await getAxiosInstance();
			return updateAccount(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.account.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
