import type { AxiosInstance } from 'axios';

import { TDeleteAccountBody, TDeleteAccountResponse, TUpdateUserBody } from '../api';
import { TPolicyKind, TUser } from '../models';
import { API_ROUTES } from '../routes';

export const getCurrentUser = async(axios: AxiosInstance) => {
	const response = await axios.get<{ data: TUser }>(API_ROUTES.users.me);
	return response.data.data;
};

export const updateCurrentUser = async(axios: AxiosInstance, body?: TUpdateUserBody) => {
	const response = await axios.patch<{ data: TUser }>(API_ROUTES.users.updateMe, { user: body });
	return response.data.data;
};

export const deleteCurrentUser = async(axios: AxiosInstance, body: TDeleteAccountBody) => {
	const response = await axios.delete<TDeleteAccountResponse>(API_ROUTES.users.deleteMe, { data: body });
	return response.data;
};

export const acceptPolicy = async(axios: AxiosInstance, kind: TPolicyKind, version: string) => {
	const response = await axios.post(API_ROUTES.users.policyAcceptances, { kind, version });
	return response.data;
};
