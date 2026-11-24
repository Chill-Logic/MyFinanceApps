import { indexClaudeToolCalls, QUERY_KEYS } from '@myfinance/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseIndexClaudeToolCallsProps = {
	enabled?: boolean;
	session_id?: string;
	/* Filtro por ferramenta (`tool`, o nome técnico). */
	tool?: string;
	/* "Carregar mais" aumenta o tamanho da página em vez de paginar (a lista é curta e fica mais simples). */
	per_page?: number;
};

export const useIndexClaudeToolCalls = (props?: TUseIndexClaudeToolCallsProps) => {
	const { enabled = true, session_id, tool, per_page = 50 } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.claude_session.get_tool_calls, session_id, tool, per_page ],
		queryFn: async() => {
			const axios = getAxiosInstance();
			return indexClaudeToolCalls(axios, session_id!, { per_page, ...(tool ? { tool } : {}) });
		},
		enabled: enabled && Boolean(session_id),
		placeholderData: keepPreviousData,
	});
};

export default useIndexClaudeToolCalls;
