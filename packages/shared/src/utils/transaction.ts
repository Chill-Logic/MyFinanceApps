import type { TTransaction } from '../models';

/*
 * Sentido de uma transação pra quem está olhando: `in` (+), `out` (−) ou `internal` (transferência
 * entre duas contas que a visão enxerga — neutra, sem sinal, não afeta o total).
 */
export type TTransactionDirection = 'in' | 'out' | 'internal';

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

	/*
	 * Sentido pela visão de `account_ids` (as contas que a tela está mostrando — a carteira inteira, ou uma
	 * conta só). Entrada/saída comuns não dependem da visão. Transferência: o `value` é sempre positivo e o
	 * sinal vem de quem olha — origem visível e destino não = saída; destino visível e origem não = entrada;
	 * as duas visíveis = movimento interno. Espelha a regra do backend pros totais.
	 */
	direction: (
		transaction: Pick<TTransaction, 'kind' | 'source_id' | 'destination_account_id'>,
		account_ids: ReadonlySet<string>,
	): TTransactionDirection => {
		if (transaction.kind === 'deposit') return 'in';
		if (transaction.kind === 'withdraw') return 'out';

		const sees_source = account_ids.has(transaction.source_id);
		const sees_destination = Boolean(transaction.destination_account_id) && account_ids.has(transaction.destination_account_id as string);
		if (sees_source && sees_destination) return 'internal';
		return sees_destination ? 'in' : 'out';
	},
};
