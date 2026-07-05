
import { TStackParam } from '../../types/screen';

import SignInScreen from '../../screens/sign-in';
import SignUpScreen from '../../screens/sign-up';

const AUTH_SCREENS: TStackParam[] = [
	{ name: 'SignIn', component: SignInScreen },
	{ name: 'SignUp', component: SignUpScreen },
];

export default AUTH_SCREENS;
