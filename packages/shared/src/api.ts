import { TAccount, TAccountKind, TBankAccountLink, TBankConnection, TBankImport, TBankImportMode, TClaudeSession, TClaudeToolCall, TCreditBalance, TCreditCard, TCurrentInvoice, TInvite, TPendingInvoiceReview, TPendingMatchReview, TRecurrence, TRecurrenceFrequency, TRecurrenceType, TRecurrenceValueMode, TTransaction, TTransactionKind, TTransactionSourceType, TUserPreferences, TWallet } from './models';

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

/* `created` = a conta acabou de ser criada por este login (primeira vez com o Google). */
export type TGoogleSignInResponse = TSignInResponse & { created: boolean };

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
	/* Merge raso no backend: só as chaves enviadas mudam. */
	preferences?: TUserPreferences;
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
/* Resumo da fatura de um cartão no index de transações: os campos do `GET /credit_balances/:id/invoice` + o id. */
export type TCreditInvoiceSummary = TCurrentInvoice & { credit_balance_id: string };

export type TListTransactionsResponse = {
	accounts: TTransactionGroup;
	/*
	 * `invoices`: uma entrada por cartão da carteira (mesmo zerada), com a fatura escolhida pelo `credits_by`
	 * — é a MESMA fatura cujas compras vêm em `data`.
	 */
	credits: TTransactionGroup & { invoices: TCreditInvoiceSummary[] };
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

/*
 * Saldo projetado das contas de uma carteira, dia a dia (tela de Contas). Contrato no formato das outras
 * respostas da API (`{ data: ... }`, centavos, datas "YYYY-MM-DD"), de `GET /accounts/projection`. Pendências de
 * conta atrasadas e faturas vencidas e não pagas de qualquer mês anterior entram no dia de hoje.
 */
export type TCashProjectionParams = {
	wallet_id: string;
	/* Tamanho do período a partir de hoje: 7, 30 ou 90. */
	days: number;
};

export type TCashProjectionPoint = {
	date: string;
	/* Saldo somado das contas ao fim do dia, em centavos. */
	balance: number;
};

export type TCashProjection = {
	today: string;
	days: number;
	/* Soma dos saldos efetivados das contas agora. */
	start_balance: number;
	end_balance: number;
	/* Dia de menor saldo no período (o primeiro, em caso de empate). */
	lowest: TCashProjectionPoint;
	/* Um ponto por dia, de hoje até hoje + `days`. */
	points: TCashProjectionPoint[];
	/* Por conta: saldo agora e previsto pro fim do mês de hoje (sem faturas — não se sabe de qual conta sai). */
	accounts: { id: string; balance: number; end_of_month_balance: number }[];
};

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

export type TIndexPendingMatchesResponse = TPaginatedResponse<TPendingMatchReview>;

export type TResolveMatchBody = {
	/* `id` de um dos `match_candidates`, ou `'none'` = "é uma transação nova" (em parcela, uma compra própria). */
	candidate_id: 'none' | (string & {});
};

export type TIndexRecurrencesResponse = TPaginatedResponse<TRecurrence>;

export type TRecurrenceBody = {
	recurrence_type: TRecurrenceType;
	kind: TTransactionKind;
	description: string;
	/* Valor de cada ocorrência (em parcelada, de cada parcela), em centavos. */
	value?: number;
	/* Só em parcelada: valor total da compra, em centavos. O backend divide pelo nº de parcelas e põe a sobra
	 * dos centavos na 1ª, como os bancos. Alterar só `value` depois descarta o total. */
	total_value?: number | null;
	value_mode?: TRecurrenceValueMode;
	frequency?: TRecurrenceFrequency;
	interval?: number;
	/* YYYY-MM-DD da primeira ocorrência. */
	start_date: string;
	/* YYYY-MM-DD; vazio = sem fim. */
	end_date?: string | null;
	/* Obrigatório em parcelada (número de parcelas). */
	occurrences_total?: number | null;
	credit_card_id?: string;
	destination_account_id?: string;
	user_id?: string;
};

export type TCreateRecurrenceBody = (TRecurrenceBody & {
	source_type: TTransactionSourceType;
	source_id: string;
}) | TCreateRecurrenceFromTransactionBody;

/*
 * Transformar uma transação já lançada em recorrência (pela edição): ela vira a 1ª ocorrência, a regra começa
 * na data dela e herda origem, tipo, descrição, valor, cartão, destino e autor — mande só a regra. Parcelar uma
 * compra lançada: `recurrence_type: 'installment'`, `occurrences_total` e `total_value` = valor dela.
 */
export type TCreateRecurrenceFromTransactionBody = Partial<TRecurrenceBody> & {
	transaction_id: string;
};

export type TUpdateRecurrenceBody = Partial<TRecurrenceBody>;

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
	/* Versão semântica da API (arquivo VERSION do backend, sobe a cada release). */
	version: string;
	hash: string;
	date: string;
	branch: string;
	/* Quando foi o deploy (ISO). `'unknown'` onde o deploy não grava. */
	deployed_at: string;
};

/*
 * Sugestão de descrição (`GET /transactions/descriptions`): descrições já usadas na carteira, agrupadas sem
 * acento/caixa/espaços repetidos (`description` = a grafia mais usada), com os dados da última ocorrência em `last`.
 */
export type TDescriptionSuggestion = {
	description: string;
	count: number;
	last_used_at: string;
	last: {
		value: number;
		kind: TTransactionKind;
		source_type: TTransactionSourceType;
		source_id: string;
		credit_card_id: string | null;
		destination_account_id: string | null;
	};
};

/* Saiu da carteira: se era a principal, o backend escolheu outra (ids `null` = ficou sem carteira principal). */
export type TLeaveWalletResponse = TMessageResponse & {
	data: { main_wallet_id: string | null; main_user_wallet_id: string | null };
};

/* `mcp_url` = URL do servidor MCP para colar no Claude (Conectores → Adicionar conector personalizado). */
export type TIndexClaudeSessionsResponse = TPaginatedResponse<TClaudeSession> & {
	mcp_url: string;
};

export type TIndexClaudeToolCallsResponse = TPaginatedResponse<TClaudeToolCall>;

export type TRevokeClaudeSessionResponse = TMessageResponse & {
	data: TClaudeSession;
};

export type TMutationParams<TResponse, TBody, TComplements = {}> = {
	id?: string | number;
	body?: TBody;
	onSuccess?: (data: TResponse)=> void;
	onError?: (error?: Error)=> void;
} & TComplements;
