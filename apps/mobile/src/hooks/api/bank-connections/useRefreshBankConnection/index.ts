import { refreshBankConnection, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams } from '../../../../types/api';
import { TBankConnection } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

/* Assíncrono: a conexão volta `UPDATING`; quem chamou faz polling com `useShowBankConnection` e roda o sync no fim. */
export const useRefreshBankConnection = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TBankConnection, {}>) => {
			const axios = await getAxiosInstance();
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
