import HomePage from '@/pages/home';

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
];
