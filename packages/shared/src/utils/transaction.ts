import type { TTransaction } from '../models';

export const TransactionUtils = {
	/*
	 * Data efetiva de uma transação pra agrupar/ordenar por dia no cliente — espelha o bucketing do
	 * backend (`COALESCE(settled_at, transaction_date)`): efetivada cai no dia em que foi paga/recebida
	 * (`settled_at`); pendente/rascunho usa o vencimento nominal (`transaction_date`). Sem isso, uma
	 * transação efetivada num dia diferente do vencimento apareceria no grupo do dia errado (e podia até
	 * cair fora do mês que o backend devolveu). Aceita qualquer objeto com esses dois campos.
	 */
	effectiveDate: (transaction: Pick<TTransaction, 'settled_at' | 'transaction_date'>): string =>
		transaction.settled_at || transaction.transaction_date,
};
