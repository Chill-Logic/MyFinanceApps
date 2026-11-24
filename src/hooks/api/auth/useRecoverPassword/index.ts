import { recoverPassword } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMessageResponse, type TMutationParams, type TRecoverPasswordBody } from '@/types';

export const useRecoverPassword = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TMessageResponse, TRecoverPasswordBody>) => {
			const axios = getAxiosInstance();
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

export default useRecoverPassword;
