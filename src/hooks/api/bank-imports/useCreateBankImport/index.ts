import { createBankImport } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateBankData } from '@/hooks/api/bank-connections/invalidateBankData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TBankImport, type TBankImportBody, type TMutationParams } from '@/types';

export const useCreateBankImport = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TBankImport, TBankImportBody>) => {
			const axios = getAxiosInstance();
			return createBankImport(axios, body!);
		},
		onSuccess: (data, { onSuccess }) => {
			invalidateBankData();
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			invalidateBankData();
			onError?.(error);
		},
	});
};

export default useCreateBankImport;
