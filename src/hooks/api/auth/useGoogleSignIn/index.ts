import { signInWithGoogle, type TAcceptedPolicies, type TGoogleSignInResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams } from '@/types';

/* Troca o ID token do Google (credencial do botão) pelo JWT da API. */
export const useGoogleSignIn = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TGoogleSignInResponse, { id_token: string; accepted_policies?: TAcceptedPolicies }>) => {
			const axios = getAxiosInstance();
			return signInWithGoogle(axios, body!.id_token, body!.accepted_policies);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useGoogleSignIn;
