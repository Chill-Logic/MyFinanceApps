import { TransactionUtils, type TTransaction } from '@myfinance/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/*
 * Agrupamento por dia das listas de transações (Home e "Nesta fatura" de Cartões): cabeçalho "Seg, 30 nov"
 * e os itens do dia, do mais recente pro mais antigo. Um lugar só, pra as duas listas não divergirem.
 */
/* "Dom, 30 nov" — dia da semana abreviado + dia + mês abreviado, como no mockup do redesign. */
const groupLabel = (date: Date) => {
	const label = format(date, 'EEE, d MMM', { locale: ptBR }).replace(/\./g, '');
	return label.charAt(0).toUpperCase() + label.slice(1);
};

export const groupTransactionsByDay = (transactions: TTransaction[]) => {
	const groups = new Map<string, { label: string; items: TTransaction[] }>();

	transactions.forEach((transaction_item) => {
		const date = new Date(TransactionUtils.groupingDate(transaction_item));
		const key = format(date, 'yyyy-MM-dd');

		if (!groups.has(key)) {
			groups.set(key, { label: groupLabel(date), items: [] });
		}
		groups.get(key)!.items.push(transaction_item);
	});

	/*
	 * Do dia mais recente pro mais antigo. O Map preserva ordem de INSERÇÃO, que é a ordem em que o
	 * backend mandou (`ORDER BY transaction_date DESC`) — mas o grupo é pela data de agrupamento, que em
	 * conta é o `settled_date` quando existe. As duas não têm relação, então sem este sort os cabeçalhos
	 * saíam na sequência das `transaction_date` (6, 8, 2, 5...). A chave é "YYYY-MM-DD" com zero à
	 * esquerda, então comparar string já ordena cronologicamente.
	 */
	return Array.from(groups.entries())
		.sort(([ a ], [ b ]) => b.localeCompare(a))
		.map(([ , group ]) => group);
};

export default groupTransactionsByDay;
