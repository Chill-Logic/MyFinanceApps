import { QUERY_KEYS, resolveMatch } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TResolveMatchBody, type TTransaction } from '@/types';

export const useResolveMatch = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TResolveMatchBody>) => {
			const axios = getAxiosInstance();
			return resolveMatch(axios, id!, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			[
				QUERY_KEYS.transaction.get_pending_reviews,
				QUERY_KEYS.transaction.get_pending_matches,
				QUERY_KEYS.transaction.get_all,
				QUERY_KEYS.account.get_all,
				QUERY_KEYS.credit_balance.get_all,
				QUERY_KEYS.credit_balance.get_invoice,
				QUERY_KEYS.credit_card.get_all,
				QUERY_KEYS.recurrence.get_all,
				QUERY_KEYS.wallet.get_main,
			].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useResolveMatch;
