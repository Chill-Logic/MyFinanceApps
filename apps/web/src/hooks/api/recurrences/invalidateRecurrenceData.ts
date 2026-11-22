import { QUERY_KEYS } from '@myfinance/shared';

import { queryClient } from '@/services/query-client';

/* Mexer numa recorrência cria/atualiza/remove ocorrências previstas — tudo que soma transações fica velho. */
export const invalidateRecurrenceData = () => {
	[
		QUERY_KEYS.recurrence.get_all,
		QUERY_KEYS.recurrence.get_one,
		QUERY_KEYS.transaction.get_all,
		QUERY_KEYS.transaction.get_pending_matches,
		QUERY_KEYS.account.get_all,
		QUERY_KEYS.account.get_projection,
		QUERY_KEYS.credit_balance.get_all,
		QUERY_KEYS.credit_balance.get_invoice,
		QUERY_KEYS.wallet.get_main,
	].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
};

export default invalidateRecurrenceData;
