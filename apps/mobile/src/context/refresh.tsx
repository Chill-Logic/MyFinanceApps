import { createContext, useContext, useState, useCallback } from 'react';
import { RefreshControlProps } from 'react-native';

import { queryClient } from '../../App';
import { QUERY_KEYS } from '../constants/QueryKeys';
import { useCurrentUserContext } from './current_user';

type RefreshOptions =
	| { keys: string[]; all?: never }
	| { keys?: never; all: boolean };

function hasKeys(options: RefreshOptions): options is { keys: string[]; all?: never } {
	return 'keys' in options;
}

const RefreshContext = createContext<{}>({});

export const RefreshProvider = ({ children }: { children: React.ReactNode }) => {
	return (
		<RefreshContext.Provider value={{}}>
			{children}
		</RefreshContext.Provider>
	);
};

export const useRefresh = (options: RefreshOptions) => {

	const context = useContext(RefreshContext);
	if (!context) {
		throw new Error('useRefresh deve ser usado dentro de um RefreshProvider');
	}

	const { current_user } = useCurrentUserContext();
	const [ isRefreshing, setIsRefreshing ] = useState(false);

	const refresh = useCallback(async() => {
		if (!current_user.data) {return;}

		setIsRefreshing(true);
		try {
			if (hasKeys(options)) {
				await Promise.all(
					options.keys.map(key => queryClient.invalidateQueries({ queryKey: [ key ] })),
				);
			} else if ('all' in options) {
				await Promise.all(
					Object.values(QUERY_KEYS).map(model_keys => {
						return Promise.all(
							Object.values(model_keys).map(key => queryClient.invalidateQueries({ queryKey: [ key ] })),
						);
					}),
				);
			} else {
				throw new Error('É necessário fornecer "keys" ou "all" como opção');
			}
		} catch (error) {
			console.error('Erro ao atualizar dados:', error);
		} finally {
			setIsRefreshing(false);
		}
	}, [ current_user.data, options ]);

	const refreshControlProps: RefreshControlProps = {
		refreshing: isRefreshing,
		onRefresh: refresh,
		colors: [ '#9Bd35A', '#689F38' ],
		tintColor: '#689F38',
	};

	return {
		isRefreshing,
		refresh,
		refreshControlProps,
	};
};

export default RefreshProvider;
