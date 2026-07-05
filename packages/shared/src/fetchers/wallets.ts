import type { AxiosInstance } from 'axios';

import { TGetMainWalletResponse, TIndexWalletsResponse } from '../api';
import { TWallet } from '../models';
import { API_ROUTES } from '../routes';

export const indexWallets = async(axios: AxiosInstance) => {
	const response = await axios.get<TIndexWalletsResponse>(API_ROUTES.wallets.index);
	return response.data;
};

export const getMainWallet = async(axios: AxiosInstance) => {
	const response = await axios.get<TGetMainWalletResponse>(API_ROUTES.wallets.main);
	return response.data;
};

export const createWallet = async(axios: AxiosInstance, body?: {}) => {
	const response = await axios.post<TWallet>(API_ROUTES.wallets.create, body);
	return response.data;
};

export const updateWallet = async(axios: AxiosInstance, id: string | number, body?: {}) => {
	const response = await axios.patch<TWallet>(API_ROUTES.wallets.update(id), body);
	return response.data;
};
