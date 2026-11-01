import { QUERY_KEYS } from '@myfinance/shared';

import { queryClient } from '../../../services/query-client';

/* Uma importação/sincronização/desfazer pode criar/alterar contas, créditos, cartões e transações — tudo que deriva deles fica velho. */
export const invalidateBankData = () => {
	[
		QUERY_KEYS.bank_connection.get_all,
		QUERY_KEYS.bank_connection.get_one,
		QUERY_KEYS.bank_account_link.get_all,
		QUERY_KEYS.bank_import.get_all,
		QUERY_KEYS.account.get_all,
		QUERY_KEYS.credit_balance.get_all,
		QUERY_KEYS.credit_balance.get_invoice,
		QUERY_KEYS.credit_card.get_all,
		QUERY_KEYS.transaction.get_all,
		QUERY_KEYS.transaction.get_pending_reviews,
		QUERY_KEYS.wallet.get_main,
		QUERY_KEYS.wallet.get_all,
	].forEach((key) => queryClient.invalidateQueries({ queryKey: [ key ] }));
};
