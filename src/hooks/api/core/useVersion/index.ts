import { getVersion } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

/**
 * Versão do backend em execução (hash/branch/data do commit). Muda só a cada deploy, então
 * `staleTime` alto — não precisa refetch a cada foco.
 */
export const useVersion = () => {
	return useQuery({
		queryKey: [ 'core-version' ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return getVersion(axios);
		},
		staleTime: 1000 * 60 * 60,
	});
};

export default useVersion;
