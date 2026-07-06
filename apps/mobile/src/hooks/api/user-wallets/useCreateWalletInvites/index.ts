import { createWalletInvite, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TUserWalletInviteBody } from '../../../../types/api';
import { TInvite } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateWalletInvites = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TInvite, TUserWalletInviteBody>) => {
			const axios = await getAxiosInstance();
			return createWalletInvite(axios, body);
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
