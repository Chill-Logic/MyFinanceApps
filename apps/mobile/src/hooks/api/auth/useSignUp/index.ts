import { signUp } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import {
	type TMutationParams,
	type TSignUpBody,
	type TSignUpResponse,
} from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useSignUp = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TSignUpResponse, TSignUpBody>) => {
			const axios = await getAxiosInstance();
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
