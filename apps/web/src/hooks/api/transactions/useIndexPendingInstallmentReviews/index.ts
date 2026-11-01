import { indexPendingInstallmentReviews, QUERY_KEYS, type TIndexPendingInstallmentReviewsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexPendingInstallmentReviewsProps = {
	enabled?: boolean;
	params?: TIndexPendingInstallmentReviewsParams;
};

export const useIndexPendingInstallmentReviews = (props?: TUseIndexPendingInstallmentReviewsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_pending_installment_reviews, params?.wallet_id, params?.source_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexPendingInstallmentReviews(axios, params);
		},
		enabled,
	});
};

export default useIndexPendingInstallmentReviews;
