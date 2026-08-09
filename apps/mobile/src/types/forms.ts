import { TAccountKind, TTransaction, TTransactionSourceType } from './models';

export type TNewTransactionForm = {
	kind: TTransaction['kind'];
	description: string;
	value: string;
	/* "Data prevista" (transaction_date) — dd/MM/yyyy; o horário fica separado em `transaction_time`. */
	transaction_date: string;
	transaction_time: string;
	/* "Pago em" (settled_date) — vazio = pendente; horário separado em `settled_time`. */
	settled_date: string;
	settled_time: string;
	/* Origem codificada como `${source_type}:${source_id}` (ex.: "Account:uuid"). */
	origin: string;
	credit_card_id: string;
	/* `draft`: planejamento, fora dos totais. */
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
