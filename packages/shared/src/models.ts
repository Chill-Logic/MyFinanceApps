export type TTransactionKind = 'deposit' | 'withdraw';

type TModelFields = {
	id: string;
	created_at: string;
	updated_at: string;
	discarded_at: string | null;
};

type WithModelFields<T> = TModelFields & T;

export type TUser = WithModelFields<{
	name: string;
	email: string;
	main_user_wallet_id: string | null;
}>;

export type TTransaction = WithModelFields<{
	description: string;
	value: number;
	kind: TTransactionKind;
	translated_kind: string;
	wallet_id: string;
	user_id: string;
	user_name: string;
	transaction_date: string;
}>;

export type TWallet = WithModelFields<{
	name: string;
	owner_id: string;
	total: number;
}>;

export type TInvite = WithModelFields<{
	user_id: string;
	wallet_id: string;
	accepted: boolean;
	wallet_name: string;
	owner_name: string;
}>;
