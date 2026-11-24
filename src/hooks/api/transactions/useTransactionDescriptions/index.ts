import { listTransactionDescriptions, QUERY_KEYS, type TListTransactionDescriptionsParams } from '@myfinance/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseTransactionDescriptionsProps = {
	enabled?: boolean;
	params: TListTransactionDescriptionsParams;
};

/*
 * Sugestões de descrição do formulário de transação (descrições já usadas na carteira). Quem chama passa o
 * `terms` já com atraso (debounce) — aqui só busca. `keepPreviousData` mantém as sugestões na tela enquanto
 * a próxima busca chega, sem piscar.
 */
export const useTransactionDescriptions = ({ enabled = true, params }: TUseTransactionDescriptionsProps) => useQuery({
	queryKey: [ QUERY_KEYS.transaction.get_descriptions, params.wallet_id, params.terms, params.kind, params.source_type, params.source_id, params.limit ],
	queryFn: async() => {
		const axios = getAxiosInstance();
		return listTransactionDescriptions(axios, params);
	},
	placeholderData: keepPreviousData,
	staleTime: 1000 * 60,
	enabled: enabled && Boolean(params.wallet_id),
});

export default useTransactionDescriptions;
