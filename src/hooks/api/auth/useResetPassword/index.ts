import { resetPassword } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMessageResponse, type TMutationParams, type TResetPasswordBody } from '@/types';

export const useResetPassword = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TMessageResponse, TResetPasswordBody>) => {
			const axios = getAxiosInstance();
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

export default useResetPassword;
