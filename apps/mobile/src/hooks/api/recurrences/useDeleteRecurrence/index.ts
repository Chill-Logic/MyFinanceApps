import { deleteRecurrence } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMessageResponse, TMutationParams } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';
import { invalidateRecurrenceData } from '../invalidateRecurrenceData';

export const useDeleteRecurrence = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TMessageResponse, {}>) => {
			const axios = await getAxiosInstance();
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
