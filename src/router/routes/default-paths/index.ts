import { lazy } from 'react';

import { IPath } from '@/types';

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: lazy(() => import('@/pages/home')),
		template: lazy(() => import('@/components/templates/Default')),
		isMainPath: true,
	},
	{
		id: 'login',
		display: 'Login',
		path: '/signin',
		element: lazy(() => import('@/pages/auth/sign-in')),
		template: lazy(() => import('@/components/templates/Auth')),
		isMainPath: false,
	}
];