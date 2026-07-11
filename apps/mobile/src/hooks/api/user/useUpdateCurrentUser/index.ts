import { updateCurrentUser, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TUpdateUserBody } from '../../../../types/api';
import { TUser } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateCurrentUser = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TUser, TUpdateUserBody>) => {
			const axios = await getAxiosInstance();
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
