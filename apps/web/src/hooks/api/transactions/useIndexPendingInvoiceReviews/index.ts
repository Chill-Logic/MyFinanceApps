import { indexPendingInvoiceReviews, QUERY_KEYS, type TIndexPendingInvoiceReviewsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexPendingInvoiceReviewsProps = {
	enabled?: boolean;
	params?: TIndexPendingInvoiceReviewsParams;
};

export const useIndexPendingInvoiceReviews = (props?: TUseIndexPendingInvoiceReviewsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_pending_reviews, params?.wallet_id, params?.source_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexPendingInvoiceReviews(axios, params);
		},
		enabled,
	});
};

export default useIndexPendingInvoiceReviews;
