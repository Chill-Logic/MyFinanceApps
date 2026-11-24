/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	readonly VITE_API_KEY: string;
	/* URL pública do web (Vercel). O app nativo lê ${VITE_WEB_URL}/app-version.json pra saber a versão mínima. */
	readonly VITE_WEB_URL?: string;
	/* Client ID OAuth (web) do Google. Sem ele, o botão "Continuar com o Google" não aparece. */
	readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;
