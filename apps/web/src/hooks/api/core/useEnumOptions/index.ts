import { getEnumOptions } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseEnumOptionsProps = {
	entity: string;
	type: string;
	enabled?: boolean;
};

/**
 * Opções traduzidas de um enum do backend (ex. `transaction`/`kind` → Depósito/Saque). Os enums
 * são estáticos (labels vêm do locale do servidor), então `staleTime: Infinity` — não precisa
 * refetch. É a fonte de verdade dos labels, no lugar de chumbar na mão no front.
 */
export const useEnumOptions = ({ entity, type, enabled = true }: TUseEnumOptionsProps) => {
	return useQuery({
		queryKey: [ 'core-enum-options', entity, type ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return getEnumOptions(axios, entity, type);
		},
		staleTime: Infinity,
		enabled,
	});
};

export default useEnumOptions;
