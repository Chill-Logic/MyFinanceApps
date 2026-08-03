import type { AxiosInstance } from 'axios';

import { TAccountBody, TIndexAccountsResponse, TMessageResponse } from '../api';
import { TAccount } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexAccountsParams = {
	wallet_id: string;
	terms?: string;
	page?: number;
	per_page?: number;
};

export const indexAccounts = async(axios: AxiosInstance, params?: TIndexAccountsParams) => {
	const response = await axios.get<TIndexAccountsResponse>(API_ROUTES.accounts.index, { params });
	return response.data;
};

export const showAccount = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TAccount }>(API_ROUTES.accounts.show(id));
	return response.data.data;
};

export const createAccount = async(axios: AxiosInstance, wallet_id: string, body?: TAccountBody) => {
	const response = await axios.post<{ data: TAccount }>(API_ROUTES.accounts.create, { wallet_id, account: body });
	return response.data.data;
};

export const updateAccount = async(axios: AxiosInstance, id: string | number, body?: TAccountBody) => {
	const response = await axios.patch<{ data: TAccount }>(API_ROUTES.accounts.update(id), { account: body });
	return response.data.data;
};

export const deleteAccount = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.accounts.delete(id));
	return response.data;
};
