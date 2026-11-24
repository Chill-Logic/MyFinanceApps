import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

/*
 * Versão exposta em build time como globais (consumidas pelo AboutInfo):
 * - __APP_VERSION__: `version` do package.json — o major.minor ("0.3") é o prefixo de versão do app e do
 *   webapp (o CD do Android lê o mesmo campo).
 * - __APP_BUILD_DATE__: quando este build foi gerado (ISO), mostrado como versão do webapp no "Sobre".
 */
const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;

/*
 * Prévia de link (WhatsApp, Telegram, Google…) com título e descrição de cada página pública. Quem monta a prévia não
 * roda JavaScript e lê só o HTML, que num app de página única é o mesmo `index.html` em toda rota. Este plugin grava
 * no build uma cópia do `index.html` por página (`termos/index.html`...), com os metadados trocados; o resto é idêntico
 * (mesmos scripts), então o app abre normalmente. O `vercel.json` aponta cada rota pra sua cópia.
 */
const PUBLIC_PAGES = [
	{ path: 'termos', title: 'Termos de Uso · MyFinance', description: 'As regras de uso do MyFinance, app de organização e planejamento financeiro.' },
	{ path: 'privacidade', title: 'Política de Privacidade · MyFinance', description: 'Como o MyFinance trata os seus dados: o que guardamos, para quê e como excluir a sua conta.' },
];

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const publicPagesMeta = (): Plugin => ({
	name: 'public-pages-meta',
	apply: 'build',
	writeBundle(options) {
		const out_dir = options.dir ?? path.resolve(__dirname, 'dist');
		const html = readFileSync(path.join(out_dir, 'index.html'), 'utf-8');
		PUBLIC_PAGES.forEach(({ path: page, title, description }) => {
			const page_html = html
				.replace(/<title>[^<]*<\/title>/, `<title>${ escapeHtml(title) }</title>`)
				.replace(/(<meta name="description" content=")[^"]*/, `$1${ escapeHtml(description) }`)
				.replace(/(<meta property="og:title" content=")[^"]*/, `$1${ escapeHtml(title) }`)
				.replace(/(<meta property="og:description" content=")[^"]*/, `$1${ escapeHtml(description) }`)
				.replace(/(<meta property="og:url" content="https:\/\/myfinance\.app\.br\/)[^"]*/, `$1${ page }`);
			mkdirSync(path.join(out_dir, page), { recursive: true });
			writeFileSync(path.join(out_dir, page, 'index.html'), page_html);
		});
	},
});

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
		__APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
	},
	plugins: [ react(), viteTsconfigPaths({ projects: [ 'tsconfig.vite.json' ] }), publicPagesMeta() ],
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
