import type { AxiosInstance } from 'axios';

import { TCreditBalanceBody, TIndexCreditBalancesResponse, TInvoiceResponse, TMessageResponse, TPayInvoiceBody } from '../api';
import { TCreditBalance, TTransaction } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexCreditBalancesParams = {
	wallet_id: string;
	terms?: string;
	page?: number;
	per_page?: number;
};

export type TGetInvoiceParams = {
	/* Data de referência do ciclo (YYYY-MM-DD); ausente = hoje. */
	date?: string;
};

export const indexCreditBalances = async(axios: AxiosInstance, params?: TIndexCreditBalancesParams) => {
	const response = await axios.get<TIndexCreditBalancesResponse>(API_ROUTES.creditBalances.index, { params });
	return response.data;
};

export const showCreditBalance = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TCreditBalance }>(API_ROUTES.creditBalances.show(id));
	return response.data.data;
};

export const createCreditBalance = async(axios: AxiosInstance, wallet_id: string, body?: TCreditBalanceBody) => {
	const response = await axios.post<{ data: TCreditBalance }>(API_ROUTES.creditBalances.create, { wallet_id, credit_balance: body });
	return response.data.data;
};

export const updateCreditBalance = async(axios: AxiosInstance, id: string | number, body?: TCreditBalanceBody) => {
	const response = await axios.patch<{ data: TCreditBalance }>(API_ROUTES.creditBalances.update(id), { credit_balance: body });
	return response.data.data;
};

export const deleteCreditBalance = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.creditBalances.delete(id));
	return response.data;
};

export const getInvoice = async(axios: AxiosInstance, id: string | number, params?: TGetInvoiceParams) => {
	const response = await axios.get<{ data: TInvoiceResponse }>(API_ROUTES.creditBalances.invoice(id), { params });
	return response.data.data;
};

export const payInvoice = async(axios: AxiosInstance, id: string | number, body?: TPayInvoiceBody) => {
	const response = await axios.post<{ data: TTransaction }>(API_ROUTES.creditBalances.payInvoice(id), body);
	return response.data.data;
};
