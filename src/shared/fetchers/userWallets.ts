import type { AxiosInstance } from 'axios';

import { TListInvitesResponse, TMessageResponse, TUserWalletInviteBody } from '../api';
import { API_ROUTES } from '../routes';

export type TListInvitesParams = {
	page?: number;
	per_page?: number;
};

export const listInvites = async(axios: AxiosInstance, params?: TListInvitesParams) => {
	const response = await axios.get<TListInvitesResponse>(API_ROUTES.userWallets.listInvites, { params });
	return response.data;
};

export const createWalletInvite = async(axios: AxiosInstance, body?: TUserWalletInviteBody) => {
	const response = await axios.post<TMessageResponse>(API_ROUTES.userWallets.createInvite, { user_wallet: body });
	return response.data;
};

export const acceptWalletInvite = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<TMessageResponse>(API_ROUTES.userWallets.acceptInvite(id));
	return response.data;
};

export const rejectWalletInvite = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<TMessageResponse>(API_ROUTES.userWallets.rejectInvite(id));
	return response.data;
};
