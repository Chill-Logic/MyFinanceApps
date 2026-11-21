import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type TTheme = 'light' | 'dark';
export type TThemePreference = 'system' | TTheme;

interface IContextType {
	/** Tema efetivamente aplicado (já resolvido a partir da preferência). */
	theme: TTheme;
	/** O que o usuário escolheu: seguir o sistema ou fixar claro/escuro. */
	preference: TThemePreference;
	setPreference: (preference: TThemePreference)=> void;
	/** Atalho dos botões de sol/lua: fixa o tema oposto ao que está na tela. */
	toggleTheme: ()=> void;
}

const initialValue: IContextType = {
	theme: 'light',
	preference: 'system',
	setPreference: () => {},
	toggleTheme: () => {},
};

/*
 * Chave nova de propósito: a antiga (`theme`) era gravada como "light" na primeira visita de todo
 * mundo, o que impediria qualquer usuário existente de passar a seguir o tema do sistema.
 */
const STORAGE_KEY = 'theme-preference';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const readPreference = (): TThemePreference => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === 'light' || stored === 'dark' ? stored : 'system';
	} catch {
		return 'system';
	}
};

const systemTheme = (): TTheme => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light');

const ThemeContext = createContext(initialValue);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const [ preference, setPreferenceState ] = useState<TThemePreference>(readPreference);
	const [ system_theme, setSystemTheme ] = useState<TTheme>(systemTheme);

	/* Acompanha a troca de tema do sistema operacional em tempo real (não só no carregamento). */
	useEffect(() => {
		const media = window.matchMedia(DARK_QUERY);
		const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	}, []);

	const theme: TTheme = preference === 'system' ? system_theme : preference;

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
		document.documentElement.style.colorScheme = theme;
	}, [ theme ]);

	const setPreference = useCallback((next: TThemePreference) => {
		setPreferenceState(next);
		try {
			if (next === 'system') localStorage.removeItem(STORAGE_KEY);
			else localStorage.setItem(STORAGE_KEY, next);
		} catch {
			/* sem armazenamento (aba privada etc.): a escolha vale só para esta sessão */
		}
	}, []);

	const toggleTheme = useCallback(() => {
		setPreference(theme === 'dark' ? 'light' : 'dark');
	}, [ theme, setPreference ]);

	return (
		<ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme }}>
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
