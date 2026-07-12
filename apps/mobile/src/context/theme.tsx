import React, { createContext, useContext, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Theme as SharedTheme } from '@myfinance/shared';

import { LocalStorage } from '../services/storage';

import { StorageKeys } from '../types/storage';

export type TThemeMode = 'light' | 'dark';

interface Theme {
	colors: {
		text: string;
		background: string;
		border: string;
		placeholder: string;
		error: string;
	};
}

interface ThemeContextData {
	theme: Theme;
	mode: TThemeMode;
	toggleTheme: ()=> void;
	setMode: (mode: TThemeMode)=> void;
}

export const lightTheme: Theme = { colors: SharedTheme.light };
export const darkTheme: Theme = { colors: SharedTheme.dark };

const THEMES: Record<TThemeMode, Theme> = { light: lightTheme, dark: darkTheme };

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [ mode, setMode ] = useState<TThemeMode>('dark');

	/*
	 * Restaura o modo salvo no mount. `LocalStorage` (AsyncStorage) é assíncrono, então até
	 * carregar o app renderiza no default 'dark' (mesmo comportamento de antes) — sem "flash"
	 * relevante porque dark já era o padrão.
	 */
	useEffect(() => {
		(async() => {
			const stored = await LocalStorage.getItem(StorageKeys.THEME);
			if (stored === 'light' || stored === 'dark') {
				setMode(stored);
			}
		})();
	}, []);

	const applyMode = (next: TThemeMode) => {
		setMode(next);
		LocalStorage.setItem(StorageKeys.THEME, next);
	};

	const toggleTheme = () => {
		applyMode(mode === 'dark' ? 'light' : 'dark');
	};

	const theme = THEMES[mode];

	return (
		<ThemeContext.Provider value={{ theme, mode, toggleTheme, setMode: applyMode }}>
			<SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
