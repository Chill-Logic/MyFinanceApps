import { useEffect, useState } from 'react';

interface IUseThemeProps {
	prevent_storage?: boolean;
}

export function useTheme(props?: IUseThemeProps) {
	const { prevent_storage } = props || {};

	const [ theme, setTheme ] = useState<'light' | 'dark'>(
		localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
	);

	useEffect(() => {
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		if (!prevent_storage) localStorage.setItem('theme', theme);
	}, [ theme ]);

	const toggleTheme = () => {
		setTheme(theme === 'light' ? 'dark' : 'light');
	};

	return { theme, toggleTheme };
}
