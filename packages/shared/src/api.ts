import { TInvite, TTransaction, TWallet } from './models';

export type TPaginatedResponse<T> = {
	data: T[];
	total_count: number;
	total_pages: number;
};

export type TMessageResponse = {
	message: string;
};

export type TSignInResponse = {
	email: string;
	name: string;
	token: string;
};

export type TSignUpResponse = TMessageResponse;

export type TSignInBody = {
	email: string;
	password: string;
};

export type TSignUpBody = {
	name: string;
	email: string;
	password: string;
}

export type TRecoverPasswordBody = {
	email: string;
};

export type TResetPasswordBody = {
	token: string;
	password: string;
	password_confirmation: string;
};

export type TGetMainWalletResponse = TWallet

export type TListTransactionsResponse = TPaginatedResponse<TTransaction> & {
	total: number;
};

export type TIndexWalletsResponse = TPaginatedResponse<TWallet>;

export type TCreateTransactionBody = {
	description: string;
	value: number;
	kind: TTransaction['kind'];
	wallet_id: string;
	transaction_date: string;
}

export type TUpdateTransactionBody = Partial<Omit<TCreateTransactionBody, 'wallet_id'>>

export type TWalletBody = {
	name: string;
};

export type TListInvitesResponse = TPaginatedResponse<TInvite>;

export type TUserWalletInviteBody = {
	user_email: string;
	wallet_id: string;
};

export type TEnumOption = {
	value: string;
	label: string;
};

export type TEnumOptionsResponse = TEnumOption[];

export type TVersionResponse = {
	hash: string;
	date: string;
	branch: string;
};

export type TMutationParams<TResponse, TBody, TComplements = {}> = {
	id?: string | number;
	body?: TBody;
	onSuccess?: (data: TResponse)=> void;
	onError?: (error?: Error)=> void;
} & TComplements;
