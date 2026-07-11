import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

/*
 * Versões expostas em build time como globais (consumidas pelo AboutInfo):
 * - __APP_VERSION__: versão do package.json.
 * - __APP_GIT_*: branch/commit/data do webapp lidos do git no build — equivalente ao que a API
 *   expõe em GET /core/version, pra o "Sobre" mostrar as duas de forma simétrica. Fallback
 *   'unknown' quando o git não está disponível (ex.: build fora de um checkout).
 */
const readGit = (command: string, fallback: string) => {
	try {
		return execSync(command, { cwd: __dirname }).toString().trim();
	} catch {
		return fallback;
	}
};

const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;
const gitBranch = readGit('git rev-parse --abbrev-ref HEAD', 'unknown');
const gitCommit = readGit('git rev-parse --short HEAD', 'unknown');
const gitDate = readGit('git log -1 --format=%cd --date=iso-strict', 'unknown');

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
		__APP_GIT_BRANCH__: JSON.stringify(gitBranch),
		__APP_GIT_COMMIT__: JSON.stringify(gitCommit),
		__APP_GIT_DATE__: JSON.stringify(gitDate),
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
