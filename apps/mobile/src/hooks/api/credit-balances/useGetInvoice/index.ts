import { getInvoice, QUERY_KEYS, TGetInvoiceParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseGetInvoiceProps = {
	id: string;
	enabled?: boolean;
	params?: TGetInvoiceParams;
}

export const useGetInvoice = ({ id, enabled = true, params }: TUseGetInvoiceProps) => {
	return useQuery({
		queryKey: [ QUERY_KEYS.credit_balance.get_invoice, id, params?.date ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return getInvoice(axios, id, params);
		},
		enabled,
	});
};
