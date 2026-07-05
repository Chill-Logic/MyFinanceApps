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
		update: (id: string) => `/wallets/${ id }`,
	},
	transactions: {
		index: '/transactions',
		create: '/transactions',
		update: (id: string) => `/transactions/${ id }`,
		delete: (id: string) => `/transactions/${ id }`,
	},
	userWallets: {
		listInvites: '/user-wallets',
		createInvite: '/user-wallets',
		acceptInvite: (id: string) => `/user-wallets/${ id }/accept`,
		rejectInvite: (id: string) => `/user-wallets/${ id }/reject`,
	},
} as const;
