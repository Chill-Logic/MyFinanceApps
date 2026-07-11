import type { AxiosInstance } from 'axios';

import { TEnumOptionsResponse } from '../api';
import { API_ROUTES } from '../routes';

export const getEnumOptions = async(axios: AxiosInstance, entity: string, type: string) => {
	const response = await axios.get<{ data: TEnumOptionsResponse }>(API_ROUTES.core.enumOptions(entity, type));
	return response.data.data;
};
