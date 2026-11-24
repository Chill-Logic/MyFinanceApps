import type { AxiosInstance } from 'axios';

import { TAcceptedPolicies, TAuthLookupResponse, TGoogleSignInResponse, TMessageResponse, TRecoverPasswordBody, TResetPasswordBody, TSignInBody, TSignInResponse, TSignUpBody, TSignUpResponse } from '../api';
import { API_ROUTES } from '../routes';

export const signIn = async(axios: AxiosInstance, body?: TSignInBody) => {
	const response = await axios.post<{ data: TSignInResponse }>(API_ROUTES.auth.signIn, body);
	return response.data.data;
};

/* `accepted_policies` só conta quando o login CRIA a conta (backend #26). */
export const signInWithGoogle = async(axios: AxiosInstance, id_token: string, accepted_policies?: TAcceptedPolicies) => {
	const response = await axios.post<{ data: TGoogleSignInResponse }>(API_ROUTES.auth.google, { id_token, accepted_policies });
	return response.data.data;
};

export const lookupEmail = async(axios: AxiosInstance, email: string) => {
	const response = await axios.post<{ data: TAuthLookupResponse }>(API_ROUTES.auth.lookup, { email });
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
