import type { AxiosInstance } from 'axios';

import { TListInvitesResponse, TUserWalletInviteBody } from '../api';
import { TInvite } from '../models';
import { API_ROUTES } from '../routes';

export const listInvites = async(axios: AxiosInstance) => {
	const response = await axios.get<TListInvitesResponse>(API_ROUTES.userWallets.listInvites);
	return response.data;
};

export const createWalletInvite = async(axios: AxiosInstance, body?: TUserWalletInviteBody) => {
	const response = await axios.post<TInvite>(API_ROUTES.userWallets.createInvite, body);
	return response.data;
};

export const acceptWalletInvite = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<TInvite>(API_ROUTES.userWallets.acceptInvite(id));
	return response.data;
};

export const rejectWalletInvite = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<TInvite>(API_ROUTES.userWallets.rejectInvite(id));
	return response.data;
};
