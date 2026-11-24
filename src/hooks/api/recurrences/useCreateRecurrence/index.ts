import { createRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateRecurrenceData } from '@/hooks/api/recurrences/invalidateRecurrenceData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TCreateRecurrenceBody, type TMutationParams, type TRecurrence } from '@/types';

export const useCreateRecurrence = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TRecurrence, TCreateRecurrenceBody>) => {
			const axios = getAxiosInstance();
			return createRecurrence(axios, body!);
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

export default useCreateRecurrence;
