import { deleteRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateRecurrenceData } from '@/hooks/api/recurrences/invalidateRecurrenceData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMessageResponse, type TMutationParams } from '@/types';

export const useDeleteRecurrence = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, {}>) => {
			const axios = getAxiosInstance();
			return deleteRecurrence(axios, id!);
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

export default useDeleteRecurrence;
