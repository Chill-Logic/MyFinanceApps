import { createBankImport } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TBankImportBody, TMutationParams } from '../../../../types/api';
import { TBankImport } from '../../../../types/models';

import { invalidateBankData } from '../../bank-connections/invalidateBankData';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useCreateBankImport = () => {
	return useMutation({
		mutationFn: async({ body }: TMutationParams<TBankImport, TBankImportBody>) => {
			const axios = await getAxiosInstance();
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
