import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/*
 * Ponte com a casca nativa (Capacitor). Tudo aqui é no-op no navegador: o mesmo build serve o
 * site da Vercel e o app da loja, e só dentro do app `is_native` é `true`.
 */
export const is_native = Capacitor.isNativePlatform();

export const Native = {
	/*
	 * Chamado uma vez, antes do React montar. A classe `native` no <html> permite ajustes de CSS
	 * só pro app (ver o fim do index.css) sem espalhar `is_native` pelos componentes.
	 */
	init: () => {
		if (!is_native) return;
		document.documentElement.classList.add('native');
	},

	/*
	 * Ícones da status bar/barra de navegação acompanham o tema do app, não o do sistema: com o
	 * app em claro e o celular em escuro, os ícones brancos sumiriam no fundo claro.
	 * `Dark` = conteúdo claro (pra fundo escuro); `Light` = conteúdo escuro (pra fundo claro).
	 */
	syncTheme: (theme: 'light' | 'dark') => {
		if (!is_native) return;
		SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
	},
};
