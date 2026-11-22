export { colors, fontSize, fontWeight, spacing, borderRadius } from '@myfinance/shared';

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
