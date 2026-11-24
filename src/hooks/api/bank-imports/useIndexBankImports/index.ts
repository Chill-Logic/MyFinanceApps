import { indexBankImports, QUERY_KEYS, type TIndexBankImportsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexBankImportsProps = {
	enabled?: boolean;
	params?: TIndexBankImportsParams;
};

export const useIndexBankImports = (props?: TUseIndexBankImportsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.bank_import.get_all, params?.bank_account_link_id ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexBankImports(axios, { per_page: 50, ...params } as TIndexBankImportsParams);
		},
		enabled,
	});
};

export default useIndexBankImports;
