import type { TTransaction } from '../models';

export const TransactionUtils = {
	/*
	 * Data efetiva de uma transação pra agrupar/ordenar por dia no cliente — espelha o bucketing do
	 * backend (`COALESCE(settled_date, transaction_date)`): efetivada cai no dia em que foi paga/recebida
	 * (`settled_date`); pendente/rascunho usa o vencimento nominal (`transaction_date`). Sem isso, uma
	 * transação efetivada num dia diferente do vencimento apareceria no grupo do dia errado (e podia até
	 * cair fora do mês que o backend devolveu). Aceita qualquer objeto com esses dois campos.
	 */
	effectiveDate: (transaction: Pick<TTransaction, 'settled_date' | 'transaction_date'>): string =>
		transaction.settled_date || transaction.transaction_date,

	/*
	 * Data pela qual a lista agrupa por dia. Em CONTA é a data efetiva (acima), que espelha o bucketing do
	 * backend. Em CRÉDITO é sempre a `transaction_date`, a data da COMPRA: o gasto de cartão é
	 * auto-efetivado pelo backend, mas o `settled_date` pode acabar carimbado noutro dia (ex.: passando
	 * pelo endpoint de settle, que usa `Time.current`) — e aí a compra pulava pro grupo do dia do carimbo
	 * em vez de ficar no dia em que foi feita. O que o extrato de cartão mostra é quando se comprou.
	 */
	groupingDate: (transaction: Pick<TTransaction, 'settled_date' | 'transaction_date' | 'source_type'>): string =>
		(transaction.source_type === 'CreditBalance'
			? transaction.transaction_date
			: TransactionUtils.effectiveDate(transaction)),
};
