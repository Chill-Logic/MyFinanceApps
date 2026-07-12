/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	readonly VITE_API_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __APP_GIT_BRANCH__: string;
declare const __APP_GIT_COMMIT__: string;
declare const __APP_GIT_DATE__: string;
