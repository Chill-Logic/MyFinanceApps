import { createBankConnection } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TBankConnectionBody, TCreateBankConnectionResponse, TMutationParams } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';
import { invalidateBankData } from '../invalidateBankData';

export const useCreateBankConnection = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TCreateBankConnectionResponse, TBankConnectionBody>) => {
			const axios = await getAxiosInstance();
			return createBankConnection(axios, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			invalidateBankData();
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
