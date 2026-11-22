import RecoverPasswordPage from '@/pages/auth/recover-password';
import ResetPasswordPage from '@/pages/auth/reset-password';
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
	},
	{
		id: 'recover-password',
		display: 'Recuperar senha',
		path: 'auth/recover-password',
		element: RecoverPasswordPage,
		template: AuthTemplate,
		isGuestOnly: true,
	},
	{
		id: 'reset-password',
		display: 'Redefinir senha',
		path: 'auth/reset-password',
		element: ResetPasswordPage,
		template: AuthTemplate,
		isGuestOnly: true,
	},
	{
		/* Link que o backend manda no e-mail de redefinição (o código vem no caminho). */
		id: 'change-password',
		display: 'Redefinir senha',
		path: 'auth/change-password/:token',
		element: ResetPasswordPage,
		template: AuthTemplate,
		isGuestOnly: true,
	}
];
