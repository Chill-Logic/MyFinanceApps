import BankConnectionPage from '@/pages/bank-connection';
import FinancesPage from '@/pages/finances';

import { IPath } from '@/types';

import DefaultTemplate from '@/components/templates/Default';

export const FinancesPaths: IPath[] = [
	{
		id: 'finances',
		display: 'Contas & Cartões',
		path: '/accounts',
		element: FinancesPage,
		template: DefaultTemplate,
		isMainPath: true,
		isPrivate: true,
	},
	{
		id: 'bank_connection_accounts',
		display: 'Contas do banco',
		path: '/accounts/banks/:id',
		element: BankConnectionPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
];
