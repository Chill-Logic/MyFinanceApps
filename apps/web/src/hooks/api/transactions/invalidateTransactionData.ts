import { QUERY_KEYS } from '@myfinance/shared';

import { queryClient } from '@/services/query-client';

/*
 * Criar, editar, excluir ou efetivar uma transação mexe em tudo que soma transações: a lista do mês, os
 * saldos das contas, as faturas dos cartões (o card "Faturas do mês" e a aba Cartões leem a fatura de
 * cada cartão, `get_invoice`), as recorrências e as conferências pendentes. Um lugar só pra essa lista,
 * pra nenhuma mutação esquecer uma chave — já aconteceu com a fatura, que ficava velha depois de editar
 * uma compra de cartão.
 */
export const invalidateTransactionData = () => {
	[
		QUERY_KEYS.transaction.get_all,
		QUERY_KEYS.transaction.get_pending_reviews,
		QUERY_KEYS.transaction.get_pending_matches,
		QUERY_KEYS.recurrence.get_all,
		QUERY_KEYS.account.get_all,
		QUERY_KEYS.account.get_projection,
		QUERY_KEYS.credit_balance.get_all,
		QUERY_KEYS.credit_balance.get_invoice,
		QUERY_KEYS.wallet.get_main,
	].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
};

export default invalidateTransactionData;
