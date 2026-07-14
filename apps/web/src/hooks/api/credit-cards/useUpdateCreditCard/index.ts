import { updateCreditCard, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TCreditCard, type TCreditCardBody, type TMutationParams } from '@/types';

export const useUpdateCreditCard = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TCreditCard, TCreditCardBody>) => {
			const axios = getAxiosInstance();
			return updateCreditCard(axios, id!, body);
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.credit_card.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};

export default useUpdateCreditCard;
