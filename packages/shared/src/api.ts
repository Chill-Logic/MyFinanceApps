import { TAccount, TAccountKind, TBankAccountLink, TBankConnection, TBankImport, TBankImportMode, TCreditBalance, TCreditCard, TCurrentInvoice, TInvite, TPendingInstallmentReview, TPendingInvoiceReview, TTransaction, TTransactionKind, TTransactionSourceType, TWallet } from './models';

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
 * `CreditBalance`, bucket = `invoice_month` da transação). Separar evita a dupla contagem do cartão
 * (o pagamento da fatura conta só em `accounts`, as compras só em `credits`) e faz a aba Cartões
 * mostrar a fatura do mês — o cliente NÃO filtra mais `source_type` na mão.
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
	/* "Data prevista" — vencimento nominal. Aceita horário (ISO com hora). */
	transaction_date: string;
	/*
	 * "Pago em" (ISO, aceita horário). Ausente/nulo = nasce pendente. Só vale pra origem `Account` —
	 * crédito é efetivado automaticamente pelo backend (`settled_date = transaction_date`).
	 */
	settled_date?: string | null;
	/* Origem da transação — uma conta ou um saldo de crédito. */
	source_type: TTransactionSourceType;
	source_id: string;
	/* Obrigatório na prática quando `source_type === 'CreditBalance'`: qual cartão. */
	credit_card_id?: string;
	/*
	 * "YYYY-MM" da fatura em que o gasto entra. Só vale pra origem `CreditBalance`. Ausente = o backend
	 * calcula pelo ciclo do cartão (melhor dia de compra). Serve pra jogar a compra pra outra fatura
	 * sem mexer na data dela.
	 */
	invoice_month?: string;
	draft?: boolean;
	/* Obrigatório quando `kind === 'transfer'`: conta que recebe (≠ origem, que precisa ser `Account`). */
	destination_account_id?: string;
	/* Autor da transação — um dos `listWalletMembers` da carteira. Ausente = usuário autenticado. */
	user_id?: string;
}

export type TUpdateTransactionBody = Partial<{
	description: string;
	value: number;
	kind: TTransactionKind;
	transaction_date: string;
	/* "Pago em": `null` volta pra pendente; data efetiva. */
	settled_date: string | null;
	/* String vazia desvincula o cartão (ao mover a transação de um crédito pra uma conta). */
	credit_card_id: string;
	/* "YYYY-MM"; string vazia devolve o campo pro default calculado pelo ciclo do cartão. */
	invoice_month: string;
	draft: boolean;
	/*
	 * Troca de origem (conta↔conta, conta↔crédito, crédito↔crédito). Os dois vão juntos e só quando a
	 * origem muda; a carteira continua derivada da origem pelo backend.
	 */
	source_type: TTransactionSourceType;
	source_id: string;
	/* Troca o destino de uma transferência. Mudar o `kind` pra deposit/withdraw zera o destino sozinho. */
	destination_account_id: string;
	/* Troca o autor (precisa ser participante da carteira). String vazia mantém o atual. */
	user_id: string;
}>

/* `settled_date` opcional (ISO); ausente = efetiva no momento atual (backend usa `Time.current`). */
export type TSettleTransactionBody = {
	settled_date?: string;
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
	/* Melhor dia de compra (1-31) — ver `TCreditBalance.best_purchase_day`. */
	best_purchase_day: number;
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
	/* Mês da fatura a pagar no formato `YYYY-MM` (mesmo bucket do index); tem prioridade sobre `date`. */
	reference?: string;
	/* Qualquer data dentro do ciclo da fatura a pagar (usado quando `reference` não vem); ausente = hoje. */
	date?: string;
	description?: string;
	settled_date?: string;
}

export type TIndexCreditCardsResponse = TPaginatedResponse<TCreditCard>;

export type TCreditCardBody = {
	name: string;
	last_digits?: string;
}

export type TIndexPendingInvoiceReviewsResponse = TPaginatedResponse<TPendingInvoiceReview>;

export type TResolveInvoiceReviewBody = {
	/* "YYYY-MM" de uma das `invoice_candidates`. */
	invoice_month: string;
};

export type TIndexPendingInstallmentReviewsResponse = TPaginatedResponse<TPendingInstallmentReview>;

export type TResolveInstallmentReviewBody = {
	/* `installment_group` de uma das `installment_candidates`, ou `'new'` = "é uma compra nova". */
	installment_group: 'new' | (string & {});
};

export type TIndexBankConnectionsResponse = TPaginatedResponse<TBankConnection>;

export type TConnectTokenBody = {
	/* Conexão existente a reconectar/atualizar (modo atualização do widget). Ausente = conexão nova. */
	bank_connection_id?: string;
};

export type TConnectTokenResponse = {
	/* Connect token da Pluggy (vale ~30 min) — é o único dado da Pluggy que o front recebe. */
	access_token: string;
};

export type TBankConnectionBody = {
	wallet_id: string;
	/* `item.id` devolvido pelo `onSuccess` do widget da Pluggy. */
	item_id: string;
};

/* Conectar só cria a conexão e os vínculos (nada é importado ainda). */
export type TCreateBankConnectionResponse = {
	data: TBankConnection;
	links: TBankAccountLink[];
};

/* "Rodar a rotina agora": devolve os lotes criados pela rotina (pode vir vazio). */
export type TSyncBankConnectionResponse = {
	data: TBankConnection;
	links: TBankAccountLink[];
	imports: TBankImport[];
};

export type TIndexBankAccountLinksResponse = TPaginatedResponse<TBankAccountLink>;

export type TBankAccountLinkBody = {
	/* `'new'` cria conta/crédito novo; `'none'` = não importar; uuid = conta/crédito existente da mesma carteira. */
	target?: 'new' | 'none' | (string & {});
	/* Exige destino; a rotina só vale daqui pra frente. */
	auto_sync?: boolean;
	/* Só em vínculo `linked` de cartão (`CREDIT`): confirma/altera o melhor dia de compra do crédito de destino. */
	best_purchase_day?: number;
};

export type TIndexBankImportsResponse = TPaginatedResponse<TBankImport>;

export type TBankImportBody = {
	bank_account_link_id: string;
	mode: TBankImportMode;
	/* YYYY-MM-DD. */
	date_from: string;
	date_to: string;
	/* Só faz sentido em conta (BANK). */
	adjust_balance: boolean;
};

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
