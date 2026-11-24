import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Casca nativa (Android) do app web. O `appId` é o MESMO package do app em RN que já está na
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
		/*
		 * Login com o Google no app (`@capgo/capacitor-social-login`): no Android usa o Credential Manager — o login
		 * do Google dentro de WebView é bloqueado pelo próprio Google. Só o Google é empacotado; Facebook e Twitter
		 * ficam fora do APK. Apple fica desligado até existir app iOS (lá a App Store EXIGE "Entrar com a Apple"
		 * quando há login por terceiros, e o backend ainda não valida token da Apple).
		 */
		SocialLogin: {
			providers: {
				google: true,
				facebook: false,
				apple: false,
				twitter: false,
			},
			logLevel: 1,
		},
	},
};

export default config;
