import { lazy } from 'react';

import { DefaultTemplate } from '@/router/routes/templates';

import { IPath } from '@/types';

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: lazy(() => import('@/pages/home')),
		template: DefaultTemplate,
		isMainPath: true,
		isPrivate: true,
	},
];
