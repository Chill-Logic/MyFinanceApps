import { lazy } from 'react';

import { IPath } from '@/types';

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: lazy(() => import('@/pages/home')),
		template: lazy(() => import('@/components/templates/default')),
		isMainPath: true,
	}
];