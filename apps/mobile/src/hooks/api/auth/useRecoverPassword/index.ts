import { recoverPassword } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMessageResponse, TMutationParams, TRecoverPasswordBody } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useRecoverPassword = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TMessageResponse, TRecoverPasswordBody>) => {
			const axios = await getAxiosInstance();
			return recoverPassword(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
