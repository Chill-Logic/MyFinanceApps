export const API_ROUTES = {
	auth: {
		signIn: '/auth/sign_in',
		signUp: '/auth/sign_up',
		recoverPassword: '/auth/recover_password',
		resetPassword: '/auth/reset_password',
	},
	users: {
		me: '/users/me',
	},
	wallets: {
		index: '/wallets',
		main: '/wallets/main',
		create: '/wallets',
		update: (id: string | number) => `/wallets/${ id }`,
		delete: (id: string | number) => `/wallets/${ id }`,
	},
	transactions: {
		index: '/transactions',
		create: '/transactions',
		update: (id: string | number) => `/transactions/${ id }`,
		delete: (id: string | number) => `/transactions/${ id }`,
	},
	userWallets: {
		listInvites: '/user_wallets',
		createInvite: '/user_wallets',
		acceptInvite: (id: string | number) => `/user_wallets/${ id }/accept`,
		rejectInvite: (id: string | number) => `/user_wallets/${ id }/reject`,
	},
	core: {
		enumOptions: (entity: string, type: string) => `/core/enums/options/${ entity }/${ type }`,
		version: '/core/version',
	},
} as const;
