import { createCreditCard, QUERY_KEYS } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TCreditCardBody, TMutationParams } from '../../../../types/api';
import { TCreditCard } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateCreditCard = () => {
	return useMutation({
		mutationFn: async({ body, credit_balance_id }: TMutationParams<TCreditCard, TCreditCardBody, { credit_balance_id: string }>) => {
			const axios = await getAxiosInstance();
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
