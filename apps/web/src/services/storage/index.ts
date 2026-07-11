const TOKEN_KEY = 'my-finance-token';

export const AuthStorage = {
	setToken: (token: string) => {
		localStorage.setItem(TOKEN_KEY, token);
	},

	getToken: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),

	clearToken: () => {
		localStorage.removeItem(TOKEN_KEY);
		sessionStorage.removeItem(TOKEN_KEY);
	},
};
