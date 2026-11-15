/*
 * `transfer` = transferência entre contas: UM registro só (não um par saque/depósito), com origem
 * `Account` e `destination_account_id`. O sinal depende de quem olha — ver `TransactionUtils.direction`.
 */
export type TTransactionKind = 'deposit' | 'withdraw' | 'transfer';

export type TTransactionSourceType = 'Account' | 'CreditBalance';

export type TAccountKind = 'checking' | 'savings' | 'cash';

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
	/* Liberação da integração bancária (Pluggy). Toda UI de conexão bancária só aparece com `true`. */
	pluggy_enabled: boolean;
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
	/*
	 * Origem polimórfica: toda transação nasce de uma conta (`Account`) ou de um saldo de
	 * crédito (`CreditBalance`). A `wallet_id` é derivada da origem pelo backend.
	 */
	source_type: TTransactionSourceType;
	source_id: string;
	/* Nome da conta/crédito de origem (vem em todas as transações, inclusive de origem de outra carteira). */
	source_name: string;
	/* Só em transferências: a conta que recebe (pode ser de outra carteira acessível). Nulo nos outros tipos. */
	destination_account_id: string | null;
	destination_account_name: string | null;
	/* Só preenchido quando `source_type === 'CreditBalance'` — qual cartão gerou o gasto. */
	credit_card_id: string | null;
	/* Preenchido só na transação criada pelo pagamento de uma fatura (`pay_invoice`). */
	paid_credit_balance_id: string | null;
	/* "Pago em" — `null` = pendente (só entra no total previsto); data = efetivada (entra no efetivado). */
	settled_date: string | null;
	/*
	 * "YYYY-MM" da fatura em que a transação de crédito entra. `null` em transações de conta. É ISSO
	 * que define de qual fatura a transação é — não a `transaction_date`. O backend preenche pelo ciclo
	 * do cartão quando o campo não é enviado.
	 */
	invoice_month: string | null;
	settled: boolean;
	/* Rascunho/planejamento: aparece na lista, mas fica fora dos dois totais. */
	draft: boolean;
	/* Id da transação na Pluggy quando importada por uma conexão bancária; `null` = lançada à mão. */
	external_id: string | null;
	/*
	 * Só em pagamentos/estornos de cartão sincronizados: `pending` = o sync não soube de qual fatura é e
	 * alocou numa sugestão (o usuário confirma em `resolveInvoiceReview`); `resolved` = confirmado, o sync
	 * não realoca mais; `null` = não precisa de revisão.
	 */
	invoice_review: TInvoiceReview | null;
	/* Último toque do usuário (edição, efetivação, exclusão); `null` = nunca mexeu. */
	user_edited_at: string | null;
	/*
	 * Campos que o usuário editou (ou herdados do lançamento manual que a transação do banco substituiu). A
	 * sincronização bancária e a regra da recorrência continuam atualizando os outros, nunca estes.
	 */
	user_edited_fields: string[];
	/* Descrição original do banco (a `description` pode ter sido editada). `null` = lançada à mão. */
	external_description: string | null;
	/* Parcelamento: "n/total". `null` em compra à vista ou lançada à mão sem parcela. */
	installment_number: number | null;
	installment_total: number | null;
	/*
	 * Recorrência (assinatura, salário...) ou compra parcelada de que esta transação é uma ocorrência, e o
	 * número dela (em parcelas, o número da parcela). `null` = avulsa.
	 */
	recurrence_id: string | null;
	recurrence_index: number | null;
	recurrence_type: TRecurrenceType | null;
	/*
	 * Ocorrência PREVISTA: gerada pela recorrência (ou parcela que o banco ainda não lançou). Entra no
	 * previsto; vira `false` ao efetivar, e é substituída quando a transação do banco chega.
	 */
	projected: boolean;
	/*
	 * Só em transações do banco: `pending` = o sync achou algo parecido já lançado (manual, prevista ou outra
	 * compra parcelada) mas não teve certeza de juntar — o usuário decide em `resolveMatch`.
	 */
	match_review: TMatchReview | null;
	/* Crédito sincronizado que é pagamento de fatura; estornos e outros créditos vêm `false`. */
	bill_payment: boolean;
}>;

export type TMatchReview = 'pending' | 'resolved';

/*
 * Candidato de uma pendência de conciliação. `transaction` = algo já lançado (manual, prevista de recorrência
 * ou sincronizada com id antigo) — escolher junta as duas; `recurrence` = compra parcelada a que a parcela
 * pode pertencer. `id` é o que vai em `resolveMatch`. Valores em centavos.
 */
export type TMatchCandidate = {
	id: string;
	type: 'transaction' | 'recurrence';
	description: string;
	value: number;
	suggested: boolean;
	/* Só em `transaction`. */
	transaction_date?: string;
	settled_date?: string | null;
	projected?: boolean;
	recurrence_id?: string | null;
	bank_synced?: boolean;
	/* Só em `recurrence`. */
	installment_total?: number;
	known_installments?: number[];
	/* "YYYY-MM" do mês da compra. */
	purchase_month?: string;
	same_description?: boolean;
};

export type TPendingMatchReview = TTransaction & {
	match_candidates: TMatchCandidate[];
};

export type TRecurrenceType = 'recurring' | 'installment';

export type TRecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

export type TRecurrenceValueMode = 'fixed' | 'estimated';

/*
 * Lançamento que se repete (assinatura, salário, aluguel) ou compra parcelada no cartão. Gera ocorrências
 * PREVISTAS (`TTransaction.projected`) — 12 meses à frente nas recorrências, até a última nas parcelas.
 */
export type TRecurrence = WithModelFields<{
	recurrence_type: TRecurrenceType;
	translated_recurrence_type: string;
	/* `bank` = compra parcelada criada pela sincronização bancária. */
	origin: 'manual' | 'bank';
	kind: TTransactionKind;
	translated_kind: string;
	description: string;
	/* Descrição que o banco usa para esta recorrência (aprendida na primeira conciliação). */
	external_description: string | null;
	/* Valor de cada ocorrência, em centavos. */
	value: number;
	/* Só em parcelada: valor total da compra. A 1ª parcela leva os centavos que sobram da divisão. */
	total_value: number | null;
	/* `estimated` = varia (conta de luz, salário variável): as próximas seguem o último valor real. */
	value_mode: TRecurrenceValueMode;
	frequency: TRecurrenceFrequency;
	translated_frequency: string;
	/* A cada quantas frequências (2 + weekly = quinzenal). */
	interval: number;
	/* YYYY-MM-DD da primeira ocorrência. */
	start_date: string;
	end_date: string | null;
	/* Quantidade de ocorrências (em parcelada, o número de parcelas). */
	occurrences_total: number | null;
	source_type: TTransactionSourceType;
	source_id: string;
	source_name: string;
	credit_card_id: string | null;
	destination_account_id: string | null;
	user_id: string;
	wallet_id: string;
	/* Última ocorrência confirmada (em parcelas, a última lançada pelo banco). */
	anchor_index: number | null;
	anchor_date: string | null;
	/* Próxima ocorrência prevista, de hoje em diante. */
	next_occurrence: { id: string; transaction_date: string; value: number } | null;
}>;

export type TInvoiceReview = 'pending' | 'resolved';

/* Fatura candidata para um pagamento pendente de revisão. Valores em centavos. */
export type TInvoiceCandidate = {
	/* "YYYY-MM" — o valor a mandar em `resolveInvoiceReview`. */
	invoice_month: string;
	due_date: string;
	/* Compras da fatura. */
	amount: number;
	/* Em aberto, sem contar este pagamento. */
	open_amount: number;
	/* Onde o pagamento está alocado hoje (a sugestão do sync). */
	suggested: boolean;
};

export type TPendingInvoiceReview = TTransaction & {
	invoice_candidates: TInvoiceCandidate[];
};

export type TWallet = WithModelFields<{
	name: string;
	owner_id: string;
	/* Saldo efetivado (soma do saldo das contas, só transações efetivadas). */
	total: number;
}>;

export type TAccount = WithModelFields<{
	name: string;
	kind: TAccountKind;
	translated_kind: string;
	wallet_id: string;
	/*
	 * Saldo efetivado da conta = só transações efetivadas. O saldo de abertura não é mais uma coluna:
	 * virou uma transação "Saldo inicial" efetivada no create (ver `initial_balance` em `TAccountBody`).
	 */
	balance: number;
	/* `true` = há uma conta de banco (Pluggy) vinculada a esta conta (`TBankAccountLink` com status `linked`). */
	bank_linked: boolean;
	/* Transações do banco aguardando o usuário decidir se são algo já lançado (`TTransaction.match_review`). */
	pending_match_reviews_count: number;
}>;

/*
 * Fatura de um mês de um saldo de crédito. `amount` em centavos; `cycle_start`/`cycle_end` são
 * datetime (limites do ciclo no fuso da app); `due_date` é a data de vencimento (YYYY-MM-DD).
 * A composição vem do `invoice_month` das transações — o ciclo só informa as datas exibidas.
 */
export type TCurrentInvoice = {
	/* Valor total do ciclo em centavos (compras - estornos). */
	amount: number;
	/* Soma dos pagamentos efetivados já lançados pra esta fatura, em centavos. */
	paid_amount: number;
	/* Saldo restante a pagar (`amount` - `paid_amount`, nunca negativo), em centavos. */
	remaining: number;
	/* "YYYY-MM" desta fatura — o mesmo valor que as transações dela carregam em `invoice_month`. */
	invoice_month: string;
	cycle_start: string;
	cycle_end: string;
	due_date: string;
	/* `true` só quando a fatura foi totalmente quitada (`remaining` = 0 com `amount` > 0). */
	paid: boolean;
};

export type TCreditBalance = WithModelFields<{
	name: string;
	credit_limit: number;
	/*
	 * "Melhor dia de compra": o dia em que o ciclo VIRA. Uma compra nesse dia já entra no ciclo novo
	 * (o de maior prazo). O ciclo vai daqui até a véspera do mesmo dia no mês seguinte; `1` = ciclo
	 * igual ao mês-calendário. Substituiu o antigo `closing_day` (backend, 2026-09) — não existe mais
	 * "dia de fechamento" no domínio, porque bancos divergem sobre cobrar ou não no próprio dia.
	 */
	best_purchase_day: number;
	due_day: number;
	wallet_id: string;
	/* Total usado no ciclo atual (saídas - entradas). */
	used: number;
	/* Limite disponível = `credit_limit` - `used`. */
	available: number;
	current_invoice: TCurrentInvoice;
	/* Pagamentos/estornos sincronizados aguardando o usuário confirmar a fatura (`TTransaction.invoice_review`). */
	pending_invoice_reviews_count: number;
	/* Transações do banco aguardando o usuário decidir se são algo já lançado (`TTransaction.match_review`). */
	pending_match_reviews_count: number;
	/* `true` = há um cartão de banco (Pluggy) vinculado a este crédito (`TBankAccountLink` com status `linked`). */
	bank_linked: boolean;
}>;

export type TCreditCard = WithModelFields<{
	name: string;
	last_digits: string | null;
	credit_balance_id: string;
	external_id: string | null;
}>;

/*
 * Status do item na Pluggy. Lista não exaustiva — a Pluggy pode mandar outros valores, por isso o
 * `string` no final.
 */
export type TBankConnectionStatus = 'UPDATED' | 'UPDATING' | 'LOGIN_ERROR' | 'OUTDATED' | 'WAITING_USER_INPUT' | (string & {});

/*
 * Conexão bancária (item da Pluggy) vinculada a uma carteira. Contas, créditos, cartões e transações
 * importados por ela carregam o id da Pluggy em `external_id`. O client secret da Pluggy só existe na
 * API — o front só recebe um connect token de curta duração (`connectBankToken`).
 */
export type TBankConnection = WithModelFields<{
	wallet_id: string;
	user_id: string;
	/* Id do item na Pluggy. */
	external_id: string;
	connector_name: string | null;
	connector_image_url: string | null;
	/* Cor primária da instituição, hex sem `#` (como a Pluggy manda) ou com — trate os dois. */
	connector_primary_color: string | null;
	status: TBankConnectionStatus | null;
	execution_status: string | null;
	last_synced_at: string | null;
}>;

export type TBankAccountType = 'BANK' | 'CREDIT';

export type TBankAccountLinkStatus = 'pending' | 'linked' | 'ignored';

export type TBankImportMode = 'preserve' | 'overwrite' | 'update';

export type TBankImportTrigger = 'manual' | 'routine';

export type TBankImportStatus = 'completed' | 'failed' | 'undone';

/*
 * Lote de importação de transações de uma conta do banco para o destino do vínculo. Pode ser desfeito
 * enquanto `undoable` (senão `undo_blocker` diz o motivo).
 */
export type TBankImport = WithModelFields<{
	bank_account_link_id: string;
	user_id: string | null;
	mode: TBankImportMode;
	trigger: TBankImportTrigger;
	status: TBankImportStatus;
	/* YYYY-MM-DD. */
	date_from: string | null;
	date_to: string | null;
	adjust_balance: boolean;
	created_count: number;
	updated_count: number;
	discarded_count: number;
	skipped_count: number;
	/* Transações do banco que substituíram algo já lançado (prevista de recorrência ou lançamento manual). */
	matched_count: number;
	error_message: string | null;
	undone_at: string | null;
	undoable: boolean;
	undo_blocker: string | null;
}>;

/* Dados da conta como vieram da Pluggy. ATENÇÃO: valores em REAIS (float), não em centavos. */
export type TBankAccountExternalData = {
	balance?: number;
	currencyCode?: string;
	creditData?: {
		creditLimit?: number;
		availableCreditLimit?: number;
		balanceCloseDate?: string;
		balanceDueDate?: string;
	};
};

/*
 * Vínculo entre uma conta do banco (Pluggy) e um destino da carteira: `BANK` → `Account`, `CREDIT` →
 * `CreditBalance`. Nada é importado só por conectar: o usuário escolhe o destino, importa períodos
 * (`TBankImport`) e liga a rotina diária (`auto_sync`, só daqui pra frente).
 */
export type TBankAccountLink = WithModelFields<{
	bank_connection_id: string;
	external_id: string;
	external_type: TBankAccountType;
	external_subtype: string | null;
	name: string;
	number: string | null;
	external_data: TBankAccountExternalData;
	status: TBankAccountLinkStatus;
	target_type: 'Account' | 'CreditBalance' | null;
	target_id: string | null;
	target_name: string | null;
	auto_sync: boolean;
	/* YYYY-MM-DD — a rotina só traz transações a partir dessa data. */
	auto_sync_since: string | null;
	adjust_balance: boolean;
	last_imported_at: string | null;
	last_import: TBankImport | null;
	/*
	 * Só em cartão (`CREDIT`): o banco nem sempre informa o fechamento. `suggested_best_purchase_day` é o
	 * melhor dia de compra deduzido da última fatura; `pending` = o usuário ainda precisa confirmar (PATCH
	 * com `best_purchase_day`), `confirmed` = confirmado, `null` = não se aplica.
	 */
	suggested_best_purchase_day: number | null;
	best_purchase_day_status: 'pending' | 'confirmed' | null;
}>;

export type TInvite = WithModelFields<{
	user_id: string;
	wallet_id: string;
	accepted: boolean;
	wallet_name: string;
	owner_name: string;
}>;

export type TClaudeSessionScope = 'read' | 'read_write';

/* `pending` = autorizada na tela de consentimento, mas o Claude ainda não trocou o código por token. */
export type TClaudeSessionStatus = 'pending' | 'active' | 'expired' | 'revoked';

/* Conexão do Claude (conector MCP) do usuário. Não tem `updated_at`/`discarded_at`: revogar é `revoked_at`. */
export type TClaudeSession = {
	id: string;
	name: string;
	scope: TClaudeSessionScope;
	status: TClaudeSessionStatus;
	token_hint: string | null;
	client_name: string | null;
	expires_at: string;
	last_used_at: string | null;
	last_used_ip: string | null;
	revoked_at: string | null;
	created_at: string;
};

export type TClaudeToolCallStatus = 'success' | 'denied' | 'not_found' | 'invalid' | 'error';

/* Uma ferramenta executada pelo Claude numa conexão (auditoria). */
export type TClaudeToolCall = {
	id: string;
	tool: string;
	tool_title: string;
	kind: 'read' | 'write';
	arguments: Record<string, unknown>;
	status: TClaudeToolCallStatus;
	http_status: number | null;
	error_message: string | null;
	record_id: string | null;
	duration_ms: number | null;
	created_at: string;
};
