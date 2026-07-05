import type { AxiosInstance } from 'axios';

import { TSignInBody, TSignInResponse, TSignUpBody, TSignUpResponse } from '../api';
import { API_ROUTES } from '../routes';

export const signIn = async(axios: AxiosInstance, body?: TSignInBody) => {
	const response = await axios.post<TSignInResponse>(API_ROUTES.auth.signIn, body);
	return response.data;
};

export const signUp = async(axios: AxiosInstance, body?: TSignUpBody) => {
	const response = await axios.post<TSignUpResponse>(API_ROUTES.auth.signUp, body);
	return response.data;
};
