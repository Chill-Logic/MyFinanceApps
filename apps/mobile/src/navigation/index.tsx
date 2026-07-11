
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getPendingAnimationTypeForReplace } from '../hooks/useTabNavigate';

import { TStackParam } from '../types/screen';

import HomeScreen from '../screens/home';
import MyWalletsScreen from '../screens/my-wallets';
import WalletsInvitesScreen from '../screens/wallets-invites';
import WalletsSettingsScreen from '../screens/wallets-settings';
import AUTH_SCREENS from './auth';

const SCREENS: TStackParam[] = [
	{ name: 'Home', component: HomeScreen },
	{ name: 'WalletsInvites', component: WalletsInvitesScreen },
	{ name: 'WalletsSettings', component: WalletsSettingsScreen },
	{ name: 'MyWallets', component: MyWalletsScreen },
	...AUTH_SCREENS,
];

const Stack = createNativeStackNavigator();

const MainStack = () => {
	return (
		<NavigationContainer>
			<Stack.Navigator
				initialRouteName='SignIn'
				/*
				 * `screenOptions` PRECISA ser função, não objeto literal: `MainStack` não tem
				 * estado próprio, então na prática só renderiza uma vez (no mount) — um objeto
				 * literal aqui capturaria `getPendingAnimationTypeForReplace()` congelado no
				 * valor inicial ('push') pra sempre, nunca refletindo o que `useTabNavigate`
				 * calculou antes do `replace()` mais recente. Como função, o React Navigation
				 * invoca ela de novo a cada vez que recalcula as opções dos descriptors
				 * (acontece a cada mudança de state, inclusive em cada `replace()`, já que é o
				 * próprio Stack.Navigator quem está inscrito nesse state — independe do
				 * `MainStack` re-renderizar ou não), então o valor lido é sempre o mais recente.
				 */
				screenOptions={() => ({
					headerShown: false,
					animationTypeForReplace: getPendingAnimationTypeForReplace(),
				})}
			>
				{SCREENS.map((screen) => (
					<Stack.Screen
						key={screen.name}
						name={screen.name}
						component={screen.component}
					/>
				))}
			</Stack.Navigator>
		</NavigationContainer>
	);
};

export default MainStack;
