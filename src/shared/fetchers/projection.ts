import type { AxiosInstance } from 'axios';

import { TCashProjection, TCashProjectionParams } from '../api';
import { API_ROUTES } from '../routes';

/* Saldo projetado das contas, dia a dia (`GET /accounts/projection`). As regras moram no backend. */
export const getCashProjection = async(axios: AxiosInstance, params: TCashProjectionParams): Promise<TCashProjection> => {
	const response = await axios.get<{ data: TCashProjection }>(API_ROUTES.accounts.projection, { params });
	return response.data.data;
};
