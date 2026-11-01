import { undoBankImport } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMutationParams } from '../../../../types/api';
import { TBankImport } from '../../../../types/models';

import { invalidateBankData } from '../../bank-connections/invalidateBankData';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useUndoBankImport = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TBankImport, {}>) => {
			const axios = await getAxiosInstance();
			return undoBankImport(axios, id!);
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
