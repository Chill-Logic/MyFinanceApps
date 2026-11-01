import { updateBankAccountLink } from '@myfinance/shared';
import { useMutation } from '@tanstack/react-query';

import { TBankAccountLinkBody, TMutationParams } from '../../../../types/api';
import { TBankAccountLink } from '../../../../types/models';

import { invalidateBankData } from '../../bank-connections/invalidateBankData';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateBankAccountLink = () => {
	return useMutation({
		mutationFn: async({ id, body }: TMutationParams<TBankAccountLink, TBankAccountLinkBody>) => {
			const axios = await getAxiosInstance();
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
