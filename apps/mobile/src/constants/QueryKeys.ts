enum MODELS {
	USER = 'user',
	transaction = 'transaction',
	wallet = 'wallet',
	invite = 'invite',
}

export const QUERY_KEYS = {
	[MODELS.transaction]: {
		get_all: 'get-all-transactions',
	},
	[MODELS.USER]: {
		get_current: 'get-current-user',
	},
	[MODELS.wallet]: {
		get_main: 'get-main-wallet',
		get_all: 'get-all-wallets',
	},
	[MODELS.invite]: {
		get_all: 'get-all-invites',
	},
};
