import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
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
