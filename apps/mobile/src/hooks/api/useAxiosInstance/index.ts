
import axios from 'axios';

import { LocalStorage } from '../../../services/storage';
import env from '../../../../env';

export const getAxiosInstance = async() => {
	const token = await LocalStorage.getItem('token');

	const axiosInstance = axios.create({
		baseURL: env.API_URL,
		headers: {
			'Access-Control-Allow-Origin': '*',
		},
	});

	if (token) {
		axiosInstance.defaults.headers.common.Authorization = `Bearer ${ token }`;
	}

	return axiosInstance;
};
