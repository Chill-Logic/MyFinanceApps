import { indexCreditCards, QUERY_KEYS, TIndexCreditCardsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexCreditCardsProps = {
	enabled?: boolean;
	params?: TIndexCreditCardsParams;
}

export const useIndexCreditCards = (props?: TUseIndexCreditCardsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.credit_card.get_all, params?.credit_balance_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexCreditCards(axios, params);
		},
		enabled,
	});
};
