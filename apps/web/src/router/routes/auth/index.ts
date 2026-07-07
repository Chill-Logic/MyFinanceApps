import { lazy } from 'react';

import { IPath } from '@/types';

export const AuthPaths: IPath[] = [
	{
		id: 'login',
		display: 'Login',
		path: 'auth/sign-in',
		element: lazy(() => import('@/pages/auth/sign-in')),
		template: lazy(() => import('@/components/templates/Auth')),
		isGuestOnly: true,
	},
	{
		id: 'sign-up',
		display: 'Sign-up',
		path: 'auth/sign-up',
		element: lazy(() => import('@/pages/auth/sign-up')),
		template: lazy(() => import('@/components/templates/Auth')),
		isGuestOnly: true,
	}
];
