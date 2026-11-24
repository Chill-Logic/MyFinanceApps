import { listTransactions, QUERY_KEYS, type TListTransactionsParams } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseListTransactionsProps = {
	enabled?: boolean;
	params?: TListTransactionsParams;
};

export const useListTransactions = (props?: TUseListTransactionsProps) => {
	const { enabled = true, params } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.transaction.get_all, params?.wallet_id, params?.reference, params?.source_type, params?.source_id, params?.credits_by ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return listTransactions(axios, params);
		},
		/*
		 * Trocar SÓ o modo dos cartões (`credits_by`, o toggle "Abertas / Vencendo") mantém a resposta anterior na
		 * tela até a nova chegar: o grupo `accounts` (destaque, Entrou/Saiu, Pendente, aba Contas) é o mesmo nos
		 * dois modos, e sem isso a Início inteira voltava pro carregamento. Mês, carteira ou origem diferentes
		 * continuam carregando do zero — mostrar os números de outro mês no lugar seria enganoso.
		 */
		placeholderData: (previous, previous_query) => {
			const previous_key = previous_query?.queryKey;
			if (!previous || !previous_key) return undefined;
			const same_except_mode = previous_key[1] === params?.wallet_id
				&& previous_key[2] === params?.reference
				&& previous_key[3] === params?.source_type
				&& previous_key[4] === params?.source_id;
			return same_except_mode ? previous : undefined;
		},
		enabled,
	});
};

export default useListTransactions;
