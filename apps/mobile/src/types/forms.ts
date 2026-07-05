import { TTransaction } from './models';

export type TNewTransactionForm = {
	kind: TTransaction['kind'];
	description: string;
	value: string;
	transaction_date: string;
};

export type TSignUpForm = {
	nome: string;
	email: string;
	senha: string;
	confirmar_senha: string;
}

export type TNewWalletForm = {
	name: string;
};

export type TNewWalletInviteForm = {
	user_email: string;
};
