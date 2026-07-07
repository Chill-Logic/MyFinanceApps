import { createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useState } from 'react';

export type TTheme = 'light' | 'dark';

interface IContextType {
	theme: TTheme;
	setTheme: Dispatch<SetStateAction<TTheme>>;
	toggleTheme: ()=> void;
}

const initialValue: IContextType = {
	theme: 'light',
	setTheme: () => {},
	toggleTheme: () => {},
};

const ThemeContext = createContext(initialValue);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [ theme, setTheme ] = useState<TTheme>(
		localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
	);

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
		localStorage.setItem('theme', theme);
	}, [ theme ]);

	const toggleTheme = () => {
		setTheme((current_theme) => (current_theme === 'light' ? 'dark' : 'light'));
	};

	return (
		<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within an ThemeProvider');
	}
	return context;
};

export default ThemeProvider;
