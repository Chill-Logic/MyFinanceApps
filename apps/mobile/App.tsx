import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { QueryClientProvider } from '@tanstack/react-query';

import CurrentUserProvider from './src/context/current_user';
import NewTransactionDialogProvider from './src/context/newTransactionDialog';
import RefreshProvider from './src/context/refresh';
import { ThemeProvider } from './src/context/theme';
import WalletUserProvider from './src/context/wallet';
import './src/services/calendar-locale';
import { queryClient } from './src/services/query-client';

import MainStack from './src/navigation';

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
									<NewTransactionDialogProvider>
										<MainStack />
										<Toast
											position='top'
											topOffset={100}
											visibilityTime={3000}
										/>
									</NewTransactionDialogProvider>
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
