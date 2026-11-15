import { QUERY_KEYS, revokeClaudeSession } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TRevokeClaudeSessionResponse } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useRevokeClaudeSession = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TRevokeClaudeSessionResponse, {}>) => {
			const axios = await getAxiosInstance();
			return revokeClaudeSession(axios, id!);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.claude_session.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
