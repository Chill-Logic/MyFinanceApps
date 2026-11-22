import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Casca nativa (Android) do apps/web. O `appId` é o MESMO package do app em RN que já está na
 * Play Store (apps/mobile/app.json) — é isso que faz a loja tratar este binário como atualização
 * do app existente, não um app novo. Não troque sem querer.
 *
 * O build do Vite (`dist/`) vai empacotado dentro do APK/AAB (não carregamos a URL do site):
 * o app abre sem rede e não depende do deploy da Vercel.
 */
const config: CapacitorConfig = {
	appId: 'com.chilllogic.myfinance.app',
	appName: 'MyFinance',
	webDir: 'dist',
	plugins: {
		SystemBars: {
			/*
			 * `css`: além de deixar a WebView edge-to-edge (respeitando `viewport-fit=cover` do
			 * index.html), injeta `--safe-area-inset-*` — o `env(safe-area-inset-*)` não vem
			 * certo em WebViews Chromium < 140. As utilities `*-safe` do index.css leem as duas.
			 */
			insetsHandling: 'css',
			initialViewportFitValueHint: 'cover',
		},
	},
};

export default config;
