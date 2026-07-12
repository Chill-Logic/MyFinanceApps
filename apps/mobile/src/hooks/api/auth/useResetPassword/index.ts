import { resetPassword } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMessageResponse, TMutationParams, TResetPasswordBody } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useResetPassword = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TMessageResponse, TResetPasswordBody>) => {
			const axios = await getAxiosInstance();
			return resetPassword(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
