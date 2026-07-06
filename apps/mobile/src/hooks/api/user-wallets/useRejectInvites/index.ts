import { rejectWalletInvite, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams } from '../../../../types/api';
import { TInvite } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useRejectInvites = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TInvite, TInvite>) => {
			const axios = await getAxiosInstance();
			return rejectWalletInvite(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.invite.get_all, QUERY_KEYS.wallet.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
