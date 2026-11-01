import { indexBankAccountLinks, QUERY_KEYS, TIndexBankAccountLinksParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexBankAccountLinksProps = {
	enabled?: boolean;
	params?: TIndexBankAccountLinksParams;
}

export const useIndexBankAccountLinks = (props?: TUseIndexBankAccountLinksProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.bank_account_link.get_all, params?.bank_connection_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexBankAccountLinks(axios, { per_page: 50, ...params } as TIndexBankAccountLinksParams);
		},
		enabled,
	});
};
