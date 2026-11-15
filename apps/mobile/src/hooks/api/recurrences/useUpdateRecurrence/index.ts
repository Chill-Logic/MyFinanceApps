import { updateRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMutationParams, TUpdateRecurrenceBody } from '../../../../types/api';
import { TRecurrence } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';
import { invalidateRecurrenceData } from '../invalidateRecurrenceData';

/* `effective_from` (YYYY-MM-DD) = "esta e as próximas"; sem ele, muda a regra inteira. */
export const useUpdateRecurrence = () => {
	return useMutation({
		mutationFn: async({ body, id, effective_from }: TMutationParams<TRecurrence, TUpdateRecurrenceBody, { effective_from?: string }>) => {
			const axios = await getAxiosInstance();
			return updateRecurrence(axios, id!, body || {}, effective_from);
		},
		onSuccess: (data, { onSuccess }) => {
			invalidateRecurrenceData();
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
