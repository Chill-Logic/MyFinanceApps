import { useMutation } from '@tanstack/react-query';

import { TMutationParams, TUserWalletInviteBody } from '../../../../types/api';
import { TInvite } from '../../../../types/models';

import { queryClient } from '../../../../../App';
import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateWalletInvites = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TInvite, TUserWalletInviteBody>) => {
			const axios = await getAxiosInstance();
			const response = await axios.post<TInvite>('/user-wallets', body);
			return response.data;
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
