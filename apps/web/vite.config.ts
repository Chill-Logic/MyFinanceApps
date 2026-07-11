import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

/*
 * Lê a versão do package.json e expõe como `__APP_VERSION__` (via `fs`, não `import` de JSON,
 * pra não depender de resolveJsonModule no tsconfig do config). É o que o rodapé do NavMenu
 * exibe — equivalente ao `Constants.expoConfig?.version` do mobile.
 */
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
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
