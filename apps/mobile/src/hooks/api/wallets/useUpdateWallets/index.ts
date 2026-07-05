import { useMutation } from '@tanstack/react-query';

import { TMutationParams } from '../../../../types/api';
import { TWallet } from '../../../../types/models';

import { queryClient } from '../../../../../App';
import { QUERY_KEYS } from '../../../../constants/QueryKeys';
import { getAxiosInstance } from '../../useAxiosInstance';

export const useUpdateWallets = () => {
	return useMutation({
		mutationFn: async({ body, id }: TMutationParams<TWallet, {}>) => {
			const axios = await getAxiosInstance();
			const response = await axios.patch<TWallet>(`/wallets/${ id }`, body);
			return response.data;
		},
		onSuccess: (data, { onSuccess }) => {
			queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_all ] });
			onSuccess?.(data);
		},
		onError: (error, { onError }) => {
			onError?.(error);
		},
	});
};
