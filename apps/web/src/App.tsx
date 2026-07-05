import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Router } from './router';

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
			<Router/>
		</QueryClientProvider>
	);
}

export default App;
