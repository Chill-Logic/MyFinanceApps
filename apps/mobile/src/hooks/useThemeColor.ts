import { useTheme } from '../context/theme';

type ThemeColorKey = 'text' | 'background' | 'border' | 'placeholder' | 'error';

export function useThemeColor(
	props: { light?: string; dark?: string },
	colorName: ThemeColorKey,
) {
	const { theme } = useTheme();
	const isDark = theme.colors.background === '#121212';
	const colorFromProps = props[isDark ? 'dark' : 'light'];

	if (colorFromProps) {
		return colorFromProps;
	} else {
		return theme.colors[colorName];
	}
}
