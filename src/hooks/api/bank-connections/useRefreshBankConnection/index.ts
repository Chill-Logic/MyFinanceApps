import { refreshBankConnection, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TBankConnection, type TMutationParams } from '@/types';

/* Assíncrono: a conexão volta `UPDATING`; quem chamou faz polling com `useShowBankConnection` e roda o sync no fim. */
export const useRefreshBankConnection = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TBankConnection, {}>) => {
			const axios = getAxiosInstance();
			return refreshBankConnection(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.bank_connection.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useRefreshBankConnection;
