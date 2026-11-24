import { undoBankImport } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateBankData } from '@/hooks/api/bank-connections/invalidateBankData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TBankImport, type TMutationParams } from '@/types';

export const useUndoBankImport = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TBankImport, {}>) => {
			const axios = getAxiosInstance();
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

export default useUndoBankImport;
