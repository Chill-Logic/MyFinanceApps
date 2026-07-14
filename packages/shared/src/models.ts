export type TTransactionKind = 'deposit' | 'withdraw';

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
	/* Só preenchido quando `source_type === 'CreditBalance'` — qual cartão gerou o gasto. */
	credit_card_id: string | null;
	/* Preenchido só na transação criada pelo pagamento de uma fatura (`pay_invoice`). */
	paid_credit_balance_id: string | null;
	/* `null` = pendente (só entra no total previsto); data = efetivada (entra no efetivado). */
	settled_at: string | null;
	settled: boolean;
	/* Rascunho/planejamento: aparece na lista, mas fica fora dos dois totais. */
	draft: boolean;
}>;

export type TWallet = WithModelFields<{
	name: string;
	owner_id: string;
	/* Saldo efetivado (soma do saldo das contas, só transações efetivadas). */
	total: number;
	/* Saldo previsto (inclui transações pendentes, ignora rascunhos). */
	total_projected: number;
}>;

export type TAccount = WithModelFields<{
	name: string;
	kind: TAccountKind;
	translated_kind: string;
	initial_balance: number;
	wallet_id: string;
	/* Saldo efetivado da conta = `initial_balance` + transações efetivadas. */
	balance: number;
}>;

/*
 * Fatura do ciclo atual de um saldo de crédito. `amount` em centavos; `cycle_start`/`cycle_end`
 * são datetime (limites do ciclo no fuso da app); `due_date` é a data de vencimento (YYYY-MM-DD).
 */
export type TCurrentInvoice = {
	amount: number;
	cycle_start: string;
	cycle_end: string;
	due_date: string;
	paid: boolean;
};

export type TCreditBalance = WithModelFields<{
	name: string;
	credit_limit: number;
	closing_day: number;
	due_day: number;
	wallet_id: string;
	/* Total usado no ciclo atual (saídas - entradas). */
	used: number;
	/* Limite disponível = `credit_limit` - `used`. */
	available: number;
	current_invoice: TCurrentInvoice;
}>;

export type TCreditCard = WithModelFields<{
	name: string;
	last_digits: string | null;
	credit_balance_id: string;
}>;

export type TInvite = WithModelFields<{
	user_id: string;
	wallet_id: string;
	accepted: boolean;
	wallet_name: string;
	owner_name: string;
}>;
