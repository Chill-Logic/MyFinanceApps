import { lazy } from 'react';

import { IPath } from '@/types';

export const AuthPaths: IPath[] = [
	{
		id: 'login',
		display: 'Login',
		path: 'auth/sign-in',
		element: lazy(() => import('@/pages/auth/sign-in')),
		template: lazy(() => import('@/components/templates/Auth')),
		isMainPath: false,
	}
];