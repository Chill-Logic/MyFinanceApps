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
}>;

export type TTransaction = WithModelFields<{
	description: string;
	value: number;
	kind: TTransactionKind;
	wallet_id: string;
	transaction_date: string;
	user?: TUser;
}>;

export type TWallet = WithModelFields<{
	name: string;
	owner_id: string;
	transactions: TTransaction[];
	total: number;
}>;

export type TInvite = WithModelFields<{
	wallet_name: string;
	owner_name: string;
}>;
