import { syncBankConnection } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateBankData } from '@/hooks/api/bank-connections/invalidateBankData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TMutationParams, type TSyncBankConnectionResponse } from '@/types';

export const useSyncBankConnection = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TSyncBankConnectionResponse, {}>) => {
			const axios = getAxiosInstance();
			return syncBankConnection(axios, id!);
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

export default useSyncBankConnection;
