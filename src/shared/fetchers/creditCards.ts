import type { AxiosInstance } from 'axios';

import { TCreditCardBody, TIndexCreditCardsResponse, TMessageResponse } from '../api';
import { TCreditCard } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexCreditCardsParams = {
	credit_balance_id: string;
	terms?: string;
	page?: number;
	per_page?: number;
};

export const indexCreditCards = async(axios: AxiosInstance, params?: TIndexCreditCardsParams) => {
	const response = await axios.get<TIndexCreditCardsResponse>(API_ROUTES.creditCards.index, { params });
	return response.data;
};

export const showCreditCard = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TCreditCard }>(API_ROUTES.creditCards.show(id));
	return response.data.data;
};

export const createCreditCard = async(axios: AxiosInstance, credit_balance_id: string, body?: TCreditCardBody) => {
	const response = await axios.post<{ data: TCreditCard }>(API_ROUTES.creditCards.create, { credit_balance_id, credit_card: body });
	return response.data.data;
};

export const updateCreditCard = async(axios: AxiosInstance, id: string | number, body?: TCreditCardBody) => {
	const response = await axios.patch<{ data: TCreditCard }>(API_ROUTES.creditCards.update(id), { credit_card: body });
	return response.data.data;
};

export const deleteCreditCard = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.creditCards.delete(id));
	return response.data;
};
