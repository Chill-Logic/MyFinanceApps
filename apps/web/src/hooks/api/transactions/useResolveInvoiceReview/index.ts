import { QUERY_KEYS, resolveInvoiceReview } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TMutationParams, type TResolveInvoiceReviewBody, type TTransaction } from '@/types';

export const useResolveInvoiceReview = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TResolveInvoiceReviewBody>) => {
			const axios = getAxiosInstance();
			return resolveInvoiceReview(axios, id!, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			[
				QUERY_KEYS.transaction.get_pending_reviews,
				QUERY_KEYS.transaction.get_all,
				QUERY_KEYS.credit_balance.get_all,
				QUERY_KEYS.credit_balance.get_invoice,
				QUERY_KEYS.credit_card.get_all,
				QUERY_KEYS.wallet.get_main,
			].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useResolveInvoiceReview;
