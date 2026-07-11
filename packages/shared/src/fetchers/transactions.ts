import type { AxiosInstance } from 'axios';

import { TCreateTransactionBody, TListTransactionsResponse, TMessageResponse, TUpdateTransactionBody } from '../api';
import { TTransaction } from '../models';
import { API_ROUTES } from '../routes';

export type TListTransactionsParams = {
	wallet_id: string;
	start_date?: string;
	end_date?: string;
	timezone?: string;
	terms?: string;
	page?: number;
	per_page?: number;
};

export const listTransactions = async(axios: AxiosInstance, params?: TListTransactionsParams) => {
	const response = await axios.get<TListTransactionsResponse>(API_ROUTES.transactions.index, { params });
	return response.data;
};

export const createTransaction = async(axios: AxiosInstance, body?: TCreateTransactionBody) => {
	const response = await axios.post<{ data: TTransaction }>(API_ROUTES.transactions.create, { transaction: body });
	return response.data.data;
};

export const updateTransaction = async(axios: AxiosInstance, id: string | number, body?: TUpdateTransactionBody) => {
	const response = await axios.patch<{ data: TTransaction }>(API_ROUTES.transactions.update(id), { transaction: body });
	return response.data.data;
};

export const deleteTransaction = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.transactions.delete(id));
	return response.data;
};
