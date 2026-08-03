import { TAccountKind, TTransaction, TTransactionSourceType } from './models';

export type TNewTransactionForm = {
	kind: TTransaction['kind'];
	description: string;
	value: string;
	transaction_date: string;
	/* Origem codificada como `${source_type}:${source_id}` (ex.: "Account:uuid"). */
	origin: string;
	credit_card_id: string;
	/* `pending`: não efetivar ao criar (só no previsto). `draft`: planejamento, fora dos totais. */
	pending: boolean;
	draft: boolean;
};

export const parseOrigin = (origin: string): { source_type: TTransactionSourceType | ''; source_id: string } => {
	const [ source_type, source_id ] = origin.split(':');
	return { source_type: (source_type as TTransactionSourceType) || '', source_id: source_id || '' };
};

export type TAccountForm = {
	name: string;
	kind: TAccountKind;
	initial_balance: string;
};

export type TCreditBalanceForm = {
	name: string;
	credit_limit: string;
	closing_day: string;
	due_day: string;
};

export type TCreditCardForm = {
	name: string;
	last_digits: string;
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
