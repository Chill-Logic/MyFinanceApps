enum MODELS {
	USER = 'user',
	transaction = 'transaction',
	wallet = 'wallet',
	invite = 'invite',
	account = 'account',
	credit_balance = 'credit_balance',
	credit_card = 'credit_card',
	bank_connection = 'bank_connection',
	bank_account_link = 'bank_account_link',
	bank_import = 'bank_import',
}

export const QUERY_KEYS = {
	[MODELS.transaction]: {
		get_all: 'get-all-transactions',
		get_pending_reviews: 'get-pending-invoice-reviews',
	},
	[MODELS.USER]: {
		get_current: 'get-current-user',
	},
	[MODELS.wallet]: {
		get_main: 'get-main-wallet',
		get_all: 'get-all-wallets',
		get_members: 'get-wallet-members',
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
	[MODELS.bank_connection]: {
		get_all: 'get-all-bank-connections',
		get_one: 'get-bank-connection',
	},
	[MODELS.bank_account_link]: {
		get_all: 'get-all-bank-account-links',
	},
	[MODELS.bank_import]: {
		get_all: 'get-all-bank-imports',
	},
};
