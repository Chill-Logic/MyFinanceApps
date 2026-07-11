import type { AxiosInstance } from 'axios';

import { TUser } from '../models';
import { API_ROUTES } from '../routes';

export const getCurrentUser = async(axios: AxiosInstance) => {
	const response = await axios.get<{ data: TUser }>(API_ROUTES.users.me);
	return response.data.data;
};
