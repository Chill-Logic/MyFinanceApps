import { useMutation } from '@tanstack/react-query';

import {
	type TMutationParams,
	type TSignInBody,
	type TSignInResponse,
} from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useSignIn = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TSignInResponse, TSignInBody>) => {
			const axios = await getAxiosInstance();
			const response = await axios.post<TSignInResponse>('/auth/sign-in', body);
			return response.data;
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
