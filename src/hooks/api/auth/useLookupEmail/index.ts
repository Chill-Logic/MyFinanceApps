import { lookupEmail, type TAuthLookupResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams } from '@/types';

/* Login em duas etapas: o e-mail tem conta? Tem senha? Está ligado ao Google? (backend #30) */
export const useLookupEmail = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TAuthLookupResponse, { email: string }>) => {
			const axios = getAxiosInstance();
			return lookupEmail(axios, body!.email);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useLookupEmail;
