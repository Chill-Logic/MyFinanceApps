import type { AxiosInstance } from 'axios';

import { TGetMainWalletResponse, TIndexWalletsResponse, TMessageResponse, TWalletBody } from '../api';
import { TUser, TWallet } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexWalletsParams = {
	terms?: string;
	page?: number;
	per_page?: number;
};

export const indexWallets = async(axios: AxiosInstance, params?: TIndexWalletsParams) => {
	const response = await axios.get<TIndexWalletsResponse>(API_ROUTES.wallets.index, { params });
	return response.data;
};

export const getMainWallet = async(axios: AxiosInstance) => {
	const response = await axios.get<{ data: TGetMainWalletResponse }>(API_ROUTES.wallets.main);
	return response.data.data;
};

export const createWallet = async(axios: AxiosInstance, body?: TWalletBody) => {
	const response = await axios.post<{ data: TWallet }>(API_ROUTES.wallets.create, { wallet: body });
	return response.data.data;
};

export const updateWallet = async(axios: AxiosInstance, id: string | number, body?: TWalletBody) => {
	const response = await axios.patch<{ data: TWallet }>(API_ROUTES.wallets.update(id), { wallet: body });
	return response.data.data;
};

export const deleteWallet = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.wallets.delete(id));
	return response.data;
};

/* Participantes com convite aceito (ordenados por nome) — os autores possíveis (`user_id`) de uma transação da carteira. */
export const listWalletMembers = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TUser[] }>(API_ROUTES.wallets.members(id));
	return response.data.data;
};
