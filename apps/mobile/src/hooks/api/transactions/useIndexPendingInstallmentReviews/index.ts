import { indexPendingInstallmentReviews, QUERY_KEYS, TIndexPendingInstallmentReviewsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexPendingInstallmentReviewsProps = {
	enabled?: boolean;
	params?: TIndexPendingInstallmentReviewsParams;
}

export const useIndexPendingInstallmentReviews = (props?: TUseIndexPendingInstallmentReviewsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_pending_installment_reviews, params?.wallet_id, params?.source_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexPendingInstallmentReviews(axios, params);
		},
		enabled,
	});
};
