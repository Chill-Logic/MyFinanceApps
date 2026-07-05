
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
			<Stack.Navigator initialRouteName='SignIn' screenOptions={{ headerShown: false }}>
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
