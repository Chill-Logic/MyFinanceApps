import { createCreditCard, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { queryClient } from '@/services/query-client';

import { type TCreditCard, type TCreditCardBody, type TMutationParams } from '@/types';

export const useCreateCreditCard = () => {
	return useMutation({
		mutationFn: async({ body, credit_balance_id }: TMutationParams<TCreditCard, TCreditCardBody, { credit_balance_id: string }>) => {
			const axios = getAxiosInstance();
			return createCreditCard(axios, credit_balance_id, body);
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

export default useCreateCreditCard;
