import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Router } from './router';

import CurrentUserProvider from '@/context/current_user';
import ThemeProvider from '@/context/theme';
import WalletUserProvider from '@/context/wallet';

import Toaster from '@/components/ui/sonner';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<CurrentUserProvider>
					<WalletUserProvider>
						<Router/>
						<Toaster />
					</WalletUserProvider>
				</CurrentUserProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
