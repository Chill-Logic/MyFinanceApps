import { signIn } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TSignInBody, type TSignInResponse } from '@/types';

export const useSignIn = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TSignInResponse, TSignInBody>) => {
			const axios = getAxiosInstance();
			return signIn(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
