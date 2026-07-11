import { updateWallet, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TWalletBody } from '../../../../types/api';
import { TWallet } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateWallets = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TWallet, TWalletBody>) => {
			const axios = await getAxiosInstance();
			return updateWallet(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
