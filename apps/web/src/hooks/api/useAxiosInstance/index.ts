import axios from 'axios';

import { AuthStorage } from '@/services/storage';

export const getAxiosInstance = () => {
	const token = AuthStorage.getToken();

	const axiosInstance = axios.create({
		baseURL: import.meta.env.VITE_API_URL,
		headers: {
			'X-API-Key': import.meta.env.VITE_API_KEY,
		},
	});

	if (token) {
		axiosInstance.defaults.headers.common.Authorization = `Bearer ${ token }`;
	}

	return axiosInstance;
};
