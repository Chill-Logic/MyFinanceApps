import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

/*
 * `GestureHandlerRootView` nunca tinha sido configurado neste app (gesture-handler só
 * chegava como dependência transitiva de @react-navigation/screens, sem nenhum
 * consumidor direto) — precisa envolver a árvore inteira pra qualquer gesto nativo
 * funcionar, incluindo o drag-to-dismiss do `NavMenu` (@gorhom/bottom-sheet).
 */
function App(): React.JSX.Element {
	return (
		<GestureHandlerRootView style={styles.root}>
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
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: '#121212',
	},
});

export default App;
