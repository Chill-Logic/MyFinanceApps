import { QUERY_KEYS, revokeClaudeSession, type TRevokeClaudeSessionResponse } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams } from '@/types';

export const useRevokeClaudeSession = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TRevokeClaudeSessionResponse, undefined>) => {
			const axios = getAxiosInstance();
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

export default useRevokeClaudeSession;
