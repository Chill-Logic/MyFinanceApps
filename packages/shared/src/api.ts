import { TAccount, TAccountKind, TCreditBalance, TCreditCard, TCurrentInvoice, TInvite, TTransaction, TTransactionKind, TTransactionSourceType, TWallet } from './models';

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

export type TUpdateUserBody = {
	name?: string;
	email?: string;
	current_password?: string;
	password?: string;
	password_confirmation?: string;
	/* Define a carteira principal do usuário — id de uma carteira acessível/aceita. */
	main_wallet_id?: string;
};

export type TResetPasswordBody = {
	token: string;
	password: string;
	password_confirmation: string;
};

export type TGetMainWalletResponse = TWallet

/*
 * Uma visão (Conta OU Cartões) do index de transações: lista própria + totais próprios. Não é paginado
 * (o backend removeu a paginação em 2026-07-19 — retorna o mês inteiro de uma vez).
 */
export type TTransactionGroup = {
	data: TTransaction[];
	total_count: number;
	/* Saldo do grupo só com transações efetivadas. */
	total_settled: number;
	/* Saldo do grupo incluindo pendentes (rascunhos sempre fora). */
	total_projected: number;
};

/*
 * O index de transações vem SEPARADO em duas visões (mudança de 2026-08-02): `accounts` (origem
 * `Account`, bucket = mês-calendário por `settled_at`/`transaction_date`) e `credits` (origem
 * `CreditBalance`, bucket = ciclo da fatura de cada cartão). Separar evita a dupla contagem do cartão
 * (o pagamento da fatura conta só em `accounts`, as compras só em `credits`) e faz a aba Cartões
 * respeitar o ciclo de fechamento de cada crédito — o cliente NÃO filtra mais `source_type` na mão.
 */
export type TListTransactionsResponse = {
	accounts: TTransactionGroup;
	credits: TTransactionGroup;
};

export type TIndexWalletsResponse = TPaginatedResponse<TWallet>;

export type TCreateTransactionBody = {
	description: string;
	value: number;
	kind: TTransactionKind;
	transaction_date: string;
	/* Origem da transação — uma conta ou um saldo de crédito. */
	source_type: TTransactionSourceType;
	source_id: string;
	/* Obrigatório na prática quando `source_type === 'CreditBalance'`: qual cartão. */
	credit_card_id?: string;
	draft?: boolean;
}

/*
 * O backend não aceita mudar a origem no update (`source_type`/`source_id` fora do permit),
 * nem `settled_at` (isso é feito via settle/unsettle).
 */
export type TUpdateTransactionBody = Partial<{
	description: string;
	value: number;
	kind: TTransactionKind;
	transaction_date: string;
	credit_card_id: string;
	draft: boolean;
}>

/* `settled_at` opcional (ISO); ausente = efetiva no momento atual (backend usa `Time.current`). */
export type TSettleTransactionBody = {
	settled_at?: string;
}

export type TIndexAccountsResponse = TPaginatedResponse<TAccount>;

export type TAccountBody = {
	name: string;
	kind: TAccountKind;
	initial_balance?: number;
}

export type TIndexCreditBalancesResponse = TPaginatedResponse<TCreditBalance>;

export type TCreditBalanceBody = {
	name: string;
	credit_limit: number;
	closing_day: number;
	due_day: number;
}

export type TInvoiceResponse = TCurrentInvoice;

export type TPayInvoiceBody = {
	/* Conta que paga a fatura (gera um saque efetivado nela). */
	account_id: string;
	/*
	 * Valor do pagamento em centavos; ausente = paga o `remaining` (saldo restante do ciclo). Pode
	 * exceder o restante (paga a mais) e a mesma fatura pode ser paga mais de uma vez (parcial).
	 */
	value?: number;
	/* Mês do ciclo a pagar no formato `YYYY-MM` (mesmo ciclo do index); tem prioridade sobre `date`. */
	reference?: string;
	/* Qualquer data dentro do ciclo a pagar (usado quando `reference` não vem); ausente = hoje. */
	date?: string;
	description?: string;
	settled_at?: string;
}

export type TIndexCreditCardsResponse = TPaginatedResponse<TCreditCard>;

export type TCreditCardBody = {
	name: string;
	last_digits?: string;
}

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
