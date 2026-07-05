import { Theme as SharedTheme } from '@myfinance/shared';

import { useTheme } from '../context/theme';

type ThemeColorKey = 'text' | 'background' | 'border' | 'placeholder' | 'error';

export function useThemeColor(
	props: { light?: string; dark?: string },
	colorName: ThemeColorKey,
) {
	const { theme } = useTheme();
	const isDark = theme.colors.background === SharedTheme.dark.background;
	const colorFromProps = props[isDark ? 'dark' : 'light'];

	if (colorFromProps) {
		return colorFromProps;
	} else {
		return theme.colors[colorName];
	}
}
