import { leaveWallet, QUERY_KEYS, type TLeaveWalletResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams } from '@/types';

/* Sair de uma carteira compartilhada. Se era a principal, o backend escolhe outra e devolve o id. */
export const useLeaveWallet = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TLeaveWalletResponse, undefined>) => {
			const axios = getAxiosInstance();
			return leaveWallet(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_members ] });
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.user.get_current ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useLeaveWallet;
