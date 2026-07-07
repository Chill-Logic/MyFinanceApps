import SignInPage from '@/pages/auth/sign-in';
import SignUpPage from '@/pages/auth/sign-up';

import { IPath } from '@/types';

import AuthTemplate from '@/components/templates/Auth';

export const AuthPaths: IPath[] = [
	{
		id: 'login',
		display: 'Login',
		path: 'auth/sign-in',
		element: SignInPage,
		template: AuthTemplate,
		isGuestOnly: true,
	},
	{
		id: 'sign-up',
		display: 'Sign-up',
		path: 'auth/sign-up',
		element: SignUpPage,
		template: AuthTemplate,
		isGuestOnly: true,
	}
];
