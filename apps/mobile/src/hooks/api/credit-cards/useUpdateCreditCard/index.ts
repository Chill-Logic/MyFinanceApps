import { QUERY_KEYS, updateCreditCard } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { queryClient } from '../../../../services/query-client';

import { TCreditCardBody, TMutationParams } from '../../../../types/api';
import { TCreditCard } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateCreditCard = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TCreditCard, TCreditCardBody>) => {
			const axios = await getAxiosInstance();
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
