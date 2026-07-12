
import { TStackParam } from '../../types/screen';

import RecoverPasswordScreen from '../../screens/recover-password';
import ResetPasswordScreen from '../../screens/reset-password';
import SignInScreen from '../../screens/sign-in';
import SignUpScreen from '../../screens/sign-up';

const AUTH_SCREENS: TStackParam[] = [
	{ name: 'SignIn', component: SignInScreen },
	{ name: 'SignUp', component: SignUpScreen },
	{ name: 'RecoverPassword', component: RecoverPasswordScreen },
	{ name: 'ResetPassword', component: ResetPasswordScreen },
];

export default AUTH_SCREENS;
