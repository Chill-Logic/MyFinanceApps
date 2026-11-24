/*
 * Caminho relativo de propósito: o tailwind.config.ts carrega este arquivo direto pelo Node (jiti), que não conhece os
 * apelidos do tsconfig/Vite (`@myfinance/shared`, `@/...`).
 */
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
export { colors, fontSize, fontWeight, spacing, borderRadius } from '../shared/tokens';

/*
 * `sans` é a fonte padrão do app (Geist, servida pelo pacote @fontsource-variable/geist, importado em
 * src/index.tsx). `noto-sans`/`roboto` seguem como aliases da mesma Geist só para não quebrar quem
 * ainda usa `font-noto-sans`/`font-roboto` — remover junto com os usos restantes.
 */
const GEIST = [ 'Geist Variable', 'system-ui', 'sans-serif' ];

export const fontFamily = {
	'sans': GEIST,
	'roboto': GEIST,
	'noto-sans': GEIST,
};
