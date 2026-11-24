import { updateBankAccountLink } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { invalidateBankData } from '@/hooks/api/bank-connections/invalidateBankData';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

import { type TBankAccountLink, type TBankAccountLinkBody, type TMutationParams } from '@/types';

export const useUpdateBankAccountLink = () => {
	return useMutation({
		mutationFn: async({ id, body }: TMutationParams<TBankAccountLink, TBankAccountLinkBody>) => {
			const axios = getAxiosInstance();
			return updateBankAccountLink(axios, id!, body!);
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

export default useUpdateBankAccountLink;
