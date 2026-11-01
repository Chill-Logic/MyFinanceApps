import { createBankConnection } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateBankData } from '@/hooks/api/bank-connections/invalidateBankData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TBankConnectionBody, type TCreateBankConnectionResponse, type TMutationParams } from '@/types';

export const useCreateBankConnection = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TCreateBankConnectionResponse, TBankConnectionBody>) => {
			const axios = getAxiosInstance();
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

export default useCreateBankConnection;
