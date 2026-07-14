enum MODELS {
	USER = 'user',
	transaction = 'transaction',
	wallet = 'wallet',
	invite = 'invite',
	account = 'account',
	credit_balance = 'credit_balance',
	credit_card = 'credit_card',
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
	[MODELS.account]: {
		get_all: 'get-all-accounts',
	},
	[MODELS.credit_balance]: {
		get_all: 'get-all-credit-balances',
		get_invoice: 'get-credit-balance-invoice',
	},
	[MODELS.credit_card]: {
		get_all: 'get-all-credit-cards',
	},
};
