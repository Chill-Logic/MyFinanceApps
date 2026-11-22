import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

/*
 * Versão exposta em build time como globais (consumidas pelo AboutInfo):
 * - __APP_VERSION__: `version` do package.json — o major.minor ("0.3") é o prefixo de versão do app e do
 *   webapp (o CD do Android lê o mesmo campo).
 * - __APP_BUILD_DATE__: quando este build foi gerado (ISO), mostrado como versão do webapp no "Sobre".
 */
const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
		__APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
	},
	plugins: [ react(), viteTsconfigPaths({ projects: [ 'tsconfig.vite.json' ] }) ],
	server: {
		open: true,
	},
	build: {
		target: browserslistToEsbuild([
			'>0.2%',
			'not dead',
			'not op_mini all'
		]),
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
		dedupe: [ 'react', 'react-dom' ],
	},
});
