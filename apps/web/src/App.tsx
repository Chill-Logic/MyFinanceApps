import { QueryClientProvider } from '@tanstack/react-query';

import { Router } from './router';

import CurrentUserProvider from '@/context/current_user';
import NewTransactionDialogProvider from '@/context/newTransactionDialog';
import NewWalletDialogProvider from '@/context/newWalletDialog';
import ThemeProvider from '@/context/theme';
import WalletUserProvider from '@/context/wallet';
import { queryClient } from '@/services/query-client';

import Toaster from '@/components/ui/sonner';

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<CurrentUserProvider>
					<WalletUserProvider>
						<NewTransactionDialogProvider>
							<NewWalletDialogProvider>
								<Router/>
								<Toaster />
							</NewWalletDialogProvider>
						</NewTransactionDialogProvider>
					</WalletUserProvider>
				</CurrentUserProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
