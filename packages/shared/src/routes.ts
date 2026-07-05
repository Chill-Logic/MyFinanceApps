export const API_ROUTES = {
	auth: {
		signIn: '/auth/sign-in',
		signUp: '/auth/sign-up',
	},
	users: {
		me: '/users/me',
	},
	wallets: {
		index: '/wallets',
		main: '/wallets/main',
		create: '/wallets',
		update: (id: string | number) => `/wallets/${ id }`,
	},
	transactions: {
		index: '/transactions',
		create: '/transactions',
		update: (id: string | number) => `/transactions/${ id }`,
		delete: (id: string | number) => `/transactions/${ id }`,
	},
	userWallets: {
		listInvites: '/user-wallets',
		createInvite: '/user-wallets',
		acceptInvite: (id: string | number) => `/user-wallets/${ id }/accept`,
		rejectInvite: (id: string | number) => `/user-wallets/${ id }/reject`,
	},
} as const;
