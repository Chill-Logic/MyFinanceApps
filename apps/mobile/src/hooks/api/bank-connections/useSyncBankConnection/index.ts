import { syncBankConnection } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TMutationParams, TSyncBankConnectionResponse } from '../../../../types/api';

import { getAxiosInstance } from '../../useAxiosInstance';
import { invalidateBankData } from '../invalidateBankData';

export const useSyncBankConnection = () => {
	return useMutation({
		mutationFn: async({ id }: TMutationParams<TSyncBankConnectionResponse, {}>) => {
			const axios = await getAxiosInstance();
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
