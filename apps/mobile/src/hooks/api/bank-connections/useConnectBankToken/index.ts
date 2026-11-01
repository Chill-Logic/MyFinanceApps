import { connectBankToken } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TConnectTokenBody, TConnectTokenResponse, TMutationParams } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

/* Mutation (não query): o connect token vale ~30 min e precisa ser novo a cada abertura do widget. */
export const useConnectBankToken = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TConnectTokenResponse, TConnectTokenBody>) => {
			const axios = await getAxiosInstance();
			return connectBankToken(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
