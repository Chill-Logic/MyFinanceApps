import React, { createContext, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Theme as SharedTheme } from '@myfinance/shared';

interface ThemeContextData {
	theme: Theme;
}

interface Theme {
	colors: {
		text: string;
		background: string;
		border: string;
		placeholder: string;
		error: string;
	};
}

export const lightTheme: Theme = { colors: SharedTheme.light };
export const darkTheme: Theme = { colors: SharedTheme.dark };

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return (
		<ThemeContext.Provider value={{ theme: darkTheme }}>
			<SafeAreaView style={{ flex: 1, backgroundColor: SharedTheme.dark.background }}>
				{children}
			</SafeAreaView>
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
	}
	return context;
};
