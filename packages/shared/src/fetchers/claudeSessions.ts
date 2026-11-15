import type { AxiosInstance } from 'axios';

import { TIndexClaudeSessionsResponse, TIndexClaudeToolCallsResponse, TRevokeClaudeSessionResponse } from '../api';
import { API_ROUTES } from '../routes';

export type TIndexClaudeSessionsParams = {
	active?: boolean;
	page?: number;
	per_page?: number;
};

export type TIndexClaudeToolCallsParams = {
	tool?: string;
	page?: number;
	per_page?: number;
};

export const indexClaudeSessions = async(axios: AxiosInstance, params?: TIndexClaudeSessionsParams) => {
	const response = await axios.get<TIndexClaudeSessionsResponse>(API_ROUTES.claudeSessions.index, { params });
	return response.data;
};

export const indexClaudeToolCalls = async(axios: AxiosInstance, id: string | number, params?: TIndexClaudeToolCallsParams) => {
	const response = await axios.get<TIndexClaudeToolCallsResponse>(API_ROUTES.claudeSessions.toolCalls(id), { params });
	return response.data;
};

export const revokeClaudeSession = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TRevokeClaudeSessionResponse>(API_ROUTES.claudeSessions.revoke(id));
	return response.data;
};
