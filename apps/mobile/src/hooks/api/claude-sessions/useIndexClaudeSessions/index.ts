import { indexClaudeSessions, QUERY_KEYS } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

type TUseIndexClaudeSessionsProps = {
	enabled?: boolean;
};

export const useIndexClaudeSessions = (props?: TUseIndexClaudeSessionsProps) => {
	const { enabled = true } = props || {};

	return useQuery({
		queryKey: [ QUERY_KEYS.claude_session.get_all ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return indexClaudeSessions(axios, { per_page: 100 });
		},
		enabled,
	});
};
