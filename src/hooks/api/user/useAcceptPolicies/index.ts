import { acceptPolicy, QUERY_KEYS, type TPolicyKind } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams } from '@/types';

type TAcceptBody = { policies: { kind: TPolicyKind; version: string }[] };

/* Aceita a versão vigente de cada documento pendente (backend #26) e relê o usuário (some o `pending_policies`). */
export const useAcceptPolicies = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<void, TAcceptBody>) => {
			const axios = getAxiosInstance();
			for (const policy of body!.policies) await acceptPolicy(axios, policy.kind, policy.version);
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

export default useAcceptPolicies;
