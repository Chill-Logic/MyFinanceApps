import React, { createContext, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const darkTheme: Theme = {
	colors: {
		text: '#FFFFFF',
		background: '#121212',
		border: '#333333',
		placeholder: '#666666',
		error: '#FF4444',
	},
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return (
		<ThemeContext.Provider value={{ theme: darkTheme }}>
			<SafeAreaView style={{ flex: 1 }}>
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
