import { TInvite, TTransaction, TUser, TWallet } from './models';

export type TSignInResponse = TUser & {
	token: string;
};

export type TSignUpResponse = {
	message: string;
}

export type TSignInBody = {
	email: string;
	password: string;
};

export type TMutationParams<TResponse, TBody, TComplements = {}> = {
	id?: string | number;
	body?: TBody;
	onSuccess?: (data: TResponse)=> void;
	onError?: (error?: Error)=> void;
} & TComplements;

export type TSignUpBody = {
	name: string;
	email: string;
	password: string;
}

export type TGetMainWalletResponse = TWallet
export type TListTransactionsResponse = {
	total: number;
	transactions: TTransaction[];
};

export type TIndexWalletsResponse = TWallet[];

export type TCreateTransactionBody = {
	description: string;
	value: number;
	kind: TTransaction['kind'];
	wallet_id: string;
	transaction_date: string;
}

export type TListInvitesResponse = TInvite[]

export type TUpdateTransactionBody = Partial<Omit<TCreateTransactionBody, 'wallet_id'>>

export type TUserWalletInviteBody = {
	user_email: string;
	wallet_id: string;
}
