import { QUERY_KEYS } from '@myfinance/shared';

import { queryClient } from '../../../services/query-client';

/* Criar/alterar/remover uma recorrência mexe nas previstas — tudo que deriva das transações fica velho. */
export const invalidateRecurrenceData = () => {
	[
		QUERY_KEYS.recurrence.get_all,
		QUERY_KEYS.transaction.get_all,
		QUERY_KEYS.credit_balance.get_all,
		QUERY_KEYS.credit_balance.get_invoice,
		QUERY_KEYS.account.get_all,
		QUERY_KEYS.wallet.get_main,
	].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
};
