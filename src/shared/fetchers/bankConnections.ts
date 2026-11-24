import type { AxiosInstance } from 'axios';

import {
	TBankAccountLinkBody,
	TBankConnectionBody,
	TBankImportBody,
	TConnectTokenBody,
	TConnectTokenResponse,
	TCreateBankConnectionResponse,
	TIndexBankAccountLinksResponse,
	TIndexBankConnectionsResponse,
	TIndexBankImportsResponse,
	TMessageResponse,
	TSyncBankConnectionResponse,
} from '../api';
import { TBankAccountLink, TBankConnection, TBankImport } from '../models';
import { API_ROUTES } from '../routes';

export type TIndexBankConnectionsParams = {
	wallet_id: string;
	page?: number;
	per_page?: number;
};

export type TIndexBankAccountLinksParams = {
	bank_connection_id: string;
	page?: number;
	per_page?: number;
};

export type TIndexBankImportsParams = {
	bank_account_link_id: string;
	page?: number;
	per_page?: number;
};

export const connectBankToken = async(axios: AxiosInstance, body?: TConnectTokenBody) => {
	const response = await axios.post<{ data: TConnectTokenResponse }>(API_ROUTES.bankConnections.connectToken, body || {});
	return response.data.data;
};

export const indexBankConnections = async(axios: AxiosInstance, params?: TIndexBankConnectionsParams) => {
	const response = await axios.get<TIndexBankConnectionsResponse>(API_ROUTES.bankConnections.index, { params });
	return response.data;
};

/* Enquanto o item está `UPDATING`/`WAITING_USER_INPUT`, o backend consulta a Pluggy a cada chamada — serve de polling. */
export const showBankConnection = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TBankConnection }>(API_ROUTES.bankConnections.show(id));
	return response.data.data;
};

export const createBankConnection = async(axios: AxiosInstance, body: TBankConnectionBody) => {
	const response = await axios.post<TCreateBankConnectionResponse>(API_ROUTES.bankConnections.create, { bank_connection: body });
	return response.data;
};

/* Pede à Pluggy pra buscar de novo no banco. Assíncrono: a conexão volta `UPDATING` e o front faz polling no `show`. */
export const refreshBankConnection = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<{ data: TBankConnection }>(API_ROUTES.bankConnections.refresh(id));
	return response.data.data;
};

/* Roda a rotina agora (vínculos com `auto_sync`), com o que a Pluggy já tem. */
export const syncBankConnection = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<TSyncBankConnectionResponse>(API_ROUTES.bankConnections.sync(id));
	return response.data;
};

export const deleteBankConnection = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.delete<TMessageResponse>(API_ROUTES.bankConnections.delete(id));
	return response.data;
};

export const indexBankAccountLinks = async(axios: AxiosInstance, params?: TIndexBankAccountLinksParams) => {
	const response = await axios.get<TIndexBankAccountLinksResponse>(API_ROUTES.bankAccountLinks.index, { params });
	return response.data;
};

export const showBankAccountLink = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.get<{ data: TBankAccountLink }>(API_ROUTES.bankAccountLinks.show(id));
	return response.data.data;
};

export const updateBankAccountLink = async(axios: AxiosInstance, id: string | number, body: TBankAccountLinkBody) => {
	const response = await axios.patch<{ data: TBankAccountLink }>(API_ROUTES.bankAccountLinks.update(id), { bank_account_link: body });
	return response.data.data;
};

export const indexBankImports = async(axios: AxiosInstance, params?: TIndexBankImportsParams) => {
	const response = await axios.get<TIndexBankImportsResponse>(API_ROUTES.bankImports.index, { params });
	return response.data;
};

export const createBankImport = async(axios: AxiosInstance, body: TBankImportBody) => {
	const response = await axios.post<{ data: TBankImport }>(API_ROUTES.bankImports.create, { bank_import: body });
	return response.data.data;
};

export const undoBankImport = async(axios: AxiosInstance, id: string | number) => {
	const response = await axios.post<{ data: TBankImport }>(API_ROUTES.bankImports.undo(id));
	return response.data.data;
};
