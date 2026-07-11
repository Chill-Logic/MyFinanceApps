import { QUERY_KEYS, updateCurrentUser } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TUpdateUserBody, type TUser } from '@/types';

export const useUpdateCurrentUser = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TUser, TUpdateUserBody>) => {
			const axios = getAxiosInstance();
			return updateCurrentUser(axios, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.user.get_current ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateCurrentUser;
