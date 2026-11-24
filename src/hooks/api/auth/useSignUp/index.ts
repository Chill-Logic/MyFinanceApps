import { signUp } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TSignUpBody, type TSignUpResponse } from '@/types';

export const useSignUp = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TSignUpResponse, TSignUpBody>) => {
			const axios = getAxiosInstance();
			return signUp(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
