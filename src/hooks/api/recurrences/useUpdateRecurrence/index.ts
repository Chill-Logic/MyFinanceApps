import { updateRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateRecurrenceData } from '@/hooks/api/recurrences/invalidateRecurrenceData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TRecurrence, type TUpdateRecurrenceBody } from '@/types';

/* `effective_from` (YYYY-MM-DD) = "esta e as próximas"; ausente = a regra inteira. */
export const useUpdateRecurrence = () => {
	return useMutation({
		mutationFn: async({ id, body, effective_from }: TMutationParams<TRecurrence, TUpdateRecurrenceBody, { effective_from?: string }>) => {
			const axios = getAxiosInstance();
			return updateRecurrence(axios, id!, body!, effective_from);
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

export default useUpdateRecurrence;
