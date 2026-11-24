import RootPage from '@/pages/root';
import SettingsPage from '@/pages/settings';

import { IPath } from '@/types';

import DefaultTemplate from '@/components/templates/Default';

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: RootPage,
		template: DefaultTemplate,
		isMainPath: true,
		/* Sem `isPrivate`: visitante vê a landing; quem decide é a RootPage. */
	},
	{
		id: 'settings',
		display: 'Configurações',
		path: '/configuracoes',
		element: SettingsPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
];
