import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CurrentUserProvider from './src/context/current_user';
import RefreshProvider from './src/context/refresh';
import { ThemeProvider } from './src/context/theme';
import WalletUserProvider from './src/context/wallet';

import MainStack from './src/navigation';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
});

function App(): React.JSX.Element {
	return (
		<View style={styles.root}>
			<SafeAreaProvider>
				<StatusBar backgroundColor='#121212' barStyle='light-content' />
				<QueryClientProvider client={queryClient}>
					<ThemeProvider>
						<CurrentUserProvider>
							<WalletUserProvider>
								<RefreshProvider>
									<MainStack />
									<Toast
										position='top'
										topOffset={100}
										visibilityTime={3000}
									/>
								</RefreshProvider>
							</WalletUserProvider>
						</CurrentUserProvider>
					</ThemeProvider>
				</QueryClientProvider>
			</SafeAreaProvider>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: '#121212',
	},
});

export default App;
