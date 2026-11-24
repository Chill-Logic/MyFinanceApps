import { deleteCurrentUser, type TDeleteAccountBody, type TDeleteAccountResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams } from '@/types';

/* Excluir a própria conta (backend #25): bloqueia na hora e apaga os dados em 30 dias (`purge_at`). */
export const useDeleteCurrentUser = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TDeleteAccountResponse, TDeleteAccountBody>) => {
			const axios = getAxiosInstance();
			return deleteCurrentUser(axios, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useDeleteCurrentUser;
