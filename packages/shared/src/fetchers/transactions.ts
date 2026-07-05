import type { AxiosInstance } from 'axios';

import { TCreateTransactionBody, TListTransactionsResponse, TUpdateTransactionBody } from '../api';
import { API_ROUTES } from '../routes';

export type TListTransactionsParams = {
	wallet_id: string;
	start_date?: string;
	end_date?: string;
};

export const listTransactions = async(axios: AxiosInstance, params?: TListTransactionsParams) => {
	const response = await axios.get<TListTransactionsResponse>(API_ROUTES.transactions.index, { params });
	return response.data;
};

export const createTransaction = async(axios: AxiosInstance, body?: TCreateTransactionBody) => {
	const response = await axios.post<TListTransactionsResponse>(API_ROUTES.transactions.create, body);
	return response.data;
};

export const updateTransaction = async(axios: AxiosInstance, id: string | number, body?: TUpdateTransactionBody) => {
	const response = await axios.patch<TListTransactionsResponse>(API_ROUTES.transactions.update(id), body);
	return response.data;
};

export const deleteTransaction = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TListTransactionsResponse>(API_ROUTES.transactions.delete(id));
	return response.data;
};
