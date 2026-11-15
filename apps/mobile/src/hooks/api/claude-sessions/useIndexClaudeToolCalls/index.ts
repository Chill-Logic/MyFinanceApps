import { indexClaudeToolCalls, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexClaudeToolCallsProps = {
	enabled?: boolean;
	session_id?: string;
};

export const useIndexClaudeToolCalls = (props?: TUseIndexClaudeToolCallsProps) => {
	const { enabled = true, session_id } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.claude_session.get_tool_calls, session_id ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexClaudeToolCalls(axios, session_id!, { per_page: 50 });
		},
		enabled: enabled && Boolean(session_id),
	});
};
