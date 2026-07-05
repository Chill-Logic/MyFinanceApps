import { useMutation } from '@tanstack/react-query';

import { TMutationParams } from '../../../../types/api';
import { TInvite } from '../../../../types/models';

import { queryClient } from '../../../../../App';
import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useAcceptInvites = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TInvite, {}>) => {
			const axios = await getAxiosInstance();
			const response = await axios.post<TInvite>(`/user-wallets/${ id }/accept`);
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
