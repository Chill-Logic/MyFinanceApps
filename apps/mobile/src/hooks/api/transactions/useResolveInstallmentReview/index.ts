import { QUERY_KEYS, resolveInstallmentReview } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TMutationParams, TResolveInstallmentReviewBody } from '../../../../types/api';
import { TTransaction } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useResolveInstallmentReview = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TTransaction, TResolveInstallmentReviewBody>) => {
			const axios = await getAxiosInstance();
			return resolveInstallmentReview(axios, id!, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			[
				QUERY_KEYS.transaction.get_pending_reviews,
				QUERY_KEYS.transaction.get_pending_installment_reviews,
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
