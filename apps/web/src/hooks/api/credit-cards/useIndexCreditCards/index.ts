import { indexCreditCards, QUERY_KEYS, type TIndexCreditCardsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexCreditCardsProps = {
	enabled?: boolean;
	params?: TIndexCreditCardsParams;
};

export const useIndexCreditCards = (props?: TUseIndexCreditCardsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.credit_card.get_all, params?.credit_balance_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexCreditCards(axios, params);
		},
		enabled,
	});
};

export default useIndexCreditCards;
