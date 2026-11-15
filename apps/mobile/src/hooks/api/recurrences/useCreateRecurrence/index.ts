import { createRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TCreateRecurrenceBody, TMutationParams } from '../../../../types/api';
import { TRecurrence } from '../../../../types/models';

import { getAxiosInstance } from '../../useAxiosInstance';
import { invalidateRecurrenceData } from '../invalidateRecurrenceData';

export const useCreateRecurrence = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TRecurrence, TCreateRecurrenceBody>) => {
			const axios = await getAxiosInstance();
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
