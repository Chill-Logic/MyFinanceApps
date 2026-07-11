import type { AxiosInstance } from 'axios';

import { TUpdateUserBody } from '../api';
import { TUser } from '../models';
import { API_ROUTES } from '../routes';

export const getCurrentUser = async(axios: AxiosInstance) => {
	const response = await axios.get<{ data: TUser }>(API_ROUTES.users.me);
	return response.data.data;
};

export const updateCurrentUser = async(axios: AxiosInstance, body?: TUpdateUserBody) => {
	const response = await axios.patch<{ data: TUser }>(API_ROUTES.users.updateMe, { user: body });
	return response.data.data;
};
