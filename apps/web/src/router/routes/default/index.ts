import HomePage from '@/pages/home';
import SettingsPage from '@/pages/settings';

import { IPath } from '@/types';

import DefaultTemplate from '@/components/templates/Default';

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: HomePage,
		template: DefaultTemplate,
		isMainPath: true,
		isPrivate: true,
	},
	{
		id: 'settings',
		display: 'Configurações',
		path: '/settings',
		element: SettingsPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
];
