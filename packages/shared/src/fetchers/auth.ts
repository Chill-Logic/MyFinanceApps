import type { AxiosInstance } from 'axios';

import { TMessageResponse, TRecoverPasswordBody, TResetPasswordBody, TSignInBody, TSignInResponse, TSignUpBody, TSignUpResponse } from '../api';
import { API_ROUTES } from '../routes';

export const signIn = async(axios: AxiosInstance, body?: TSignInBody) => {
	const response = await axios.post<{ data: TSignInResponse }>(API_ROUTES.auth.signIn, body);
	return response.data.data;
};

export const signUp = async(axios: AxiosInstance, body?: TSignUpBody) => {
	const response = await axios.post<TSignUpResponse>(API_ROUTES.auth.signUp, body);
	return response.data;
};

export const recoverPassword = async(axios: AxiosInstance, body?: TRecoverPasswordBody) => {
	const response = await axios.post<TMessageResponse>(API_ROUTES.auth.recoverPassword, body);
	return response.data;
};

export const resetPassword = async(axios: AxiosInstance, body?: TResetPasswordBody) => {
	const response = await axios.post<TMessageResponse>(API_ROUTES.auth.resetPassword, body);
	return response.data;
};
