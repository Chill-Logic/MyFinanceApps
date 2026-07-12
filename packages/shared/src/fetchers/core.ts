import type { AxiosInstance } from 'axios';

import { TEnumOptionsResponse, TVersionResponse } from '../api';
import { API_ROUTES } from '../routes';

export const getEnumOptions = async(axios: AxiosInstance, entity: string, type: string) => {
	const response = await axios.get<{ data: TEnumOptionsResponse }>(API_ROUTES.core.enumOptions(entity, type));
	return response.data.data;
};

export const getVersion = async(axios: AxiosInstance) => {
	const response = await axios.get<{ data: TVersionResponse }>(API_ROUTES.core.version);
	return response.data.data;
};
