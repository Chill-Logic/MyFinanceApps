import type { AxiosInstance } from 'axios';

import { TCreateRecurrenceBody, TIndexRecurrencesResponse, TMessageResponse, TUpdateRecurrenceBody } from '../api';
import { TRecurrence, TRecurrenceType, TTransactionSourceType } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexRecurrencesParams = {
	wallet_id: string;
	recurrence_type?: TRecurrenceType;
	/* Filtra por origem (os dois juntos). */
	source_type?: TTransactionSourceType;
	source_id?: string;
	terms?: string;
	page?: number;
	per_page?: number;
};

export const indexRecurrences = async(axios: AxiosInstance, params?: TIndexRecurrencesParams) => {
	const response = await axios.get<TIndexRecurrencesResponse>(API_ROUTES.recurrences.index, { params });
	return response.data;
};

export const showRecurrence = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TRecurrence }>(API_ROUTES.recurrences.show(id));
	return response.data.data;
};

export const createRecurrence = async(axios: AxiosInstance, body: TCreateRecurrenceBody) => {
	const response = await axios.post<{ data: TRecurrence }>(API_ROUTES.recurrences.create, { recurrence: body });
	return response.data.data;
};

/*
 * Sem `effective_from`: muda a regra inteira (as previstas não editadas acompanham). Com `effective_from`
 * (YYYY-MM-DD, "esta e as próximas"): o backend encerra a regra atual na véspera e devolve a NOVA recorrência.
 */
export const updateRecurrence = async(axios: AxiosInstance, id: string | number, body: TUpdateRecurrenceBody, effective_from?: string) => {
	const response = await axios.patch<{ data: TRecurrence }>(API_ROUTES.recurrences.update(id), { recurrence: body, effective_from });
	return response.data.data;
};

/* Para de gerar: as previstas de hoje em diante saem; as passadas e as confirmadas ficam. */
export const deleteRecurrence = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.recurrences.delete(id));
	return response.data;
};
