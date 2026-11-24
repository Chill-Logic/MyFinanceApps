export const fontSize = {
	'x-small': '12px',
	'small': '14px',
	'default': '16px',
	'medium': '20px',
	'large': '22px',
	'x-large': '24px',
	'huge': '28px',
	'x-huge': '36px',
};

export const fontWeight = {
	'thin': '100',
	'extra-light': '200',
	'light': '300',
	'normal': '400',
	'medium': '500',
	'semi-bold': '600',
	'bold': '700',
	'extra-bold': '800',
	'heavy': '900',
	'ultra-black': '950',
};

export const colors = {
	'brand-main': '#C7C3BF',
	'brand-secondary': '#89A160',
	'brand-tertiary': '#6E8B4D',
	'basic-intense': '#078DA7',
	'basic-link': '#006BE2',
	'basic-light': '#D6F2FF',
	'basic-placeholder': '#888888',
	'feedback-info-light': '#D6F2FF',
	'feedback-info-default': '#006BE2',
	'feedback-info-dark': '#0D509B',
	'feedback-success-light': '#D6FFE6',
	'feedback-success-default': '#00A742',
	'feedback-success-dark': '#067532',
	'feedback-warning-light': '#FFF9C2',
	'feedback-warning-default': '#EFB003',
	'feedback-warning-dark': '#874B0C',
	'feedback-danger-light': '#FFDDE2',
	'feedback-danger-default': '#E20023',
	'feedback-danger-dark': '#AF051F',
	'stroke-default': '#C7C3BF',
	'stroke-dark': '#052131',
	'text-default': '#C7C3BF',
	'text-dark': '#052131',
	'background-light': '#C7C3BF',
	'background-input': '#DDDDDD',
	'background-default': '#082435',
};

export const spacing = {
	'none': '0px',
	'base': '4px',
	'tiny': '8px',
	'small-x': '12px',
	'small-xx': '16px',
	'small-xxx': '20px',
	'normal-x': '24px',
	'normal-xx': '28px',
	'normal-xxx': '32px',
	'giant-x': '36px',
	'giant-xx': '40px',
	'giant-xxx': '48px',
	'huge-x': '52px',
	'huge-xx': '56px',
	'huge-xxx': '60px',
	'exepcional': '64px',
};

export const borderRadius = {
	'none': '0px',
	'base': '4px',
	'small': '8px',
	'default': '12px',
	'medium': '16px',
	'large': '24px',
	'circular': '1000px',
};

/*
 * ─── Redesign (2026-11) ──────────────────────────────────────────────────────────────────────
 *
 * Paleta e papéis semânticos do redesign "moderno com a marca" (canvas "MyFinance — redesign").
 * `colors` acima é a paleta antiga: o web ainda a usa como classes Tailwind (`bg-background-light`...), mas
 * código novo deve usar os papéis do redesign (variáveis CSS do `index.css`).
 *
 * O web consome estes valores convertidos para HSL nas variáveis CSS de
 * `apps/web/src/styles/index.css` (`:root` = claro, `.dark` = escuro). Os dois lados não se
 * sincronizam sozinhos: mudou um valor aqui, recalcule o HSL lá.
 */

/** Cores-base da marca, as mesmas do logo. */
export const brandPalette = {
	navy: '#082435',       // marinho: fundo de marca, texto no claro
	navyLight: '#0F3A52',  // marinho do degradê dos cartões de destaque
	olive: '#89A160',      // oliva: ação principal no claro
	oliveLight: '#A3BC74', // oliva clareado: ação principal no escuro
	oliveDark: '#6E8B4D',  // oliva escuro (quarto inferior do logo)
	teal: '#078DA7',       // azul-petróleo do logo: cartões de crédito e "informação"
	sand: '#C7C3BF',       // areia: neutro quente da marca
	sandLight: '#F1EFEC',  // areia clara: texto no escuro, fundo do ícone sobre marinho
} as const;

/**
 * Papéis semânticos por tema. `primaryForeground` é marinho nos dois temas de propósito: o oliva
 * não tem contraste suficiente com texto branco.
 */
export const brandTheme = {
	light: {
		background: '#F3F1ED',
		sidebar: '#EFECE7',
		card: '#FFFFFF',
		field: '#F7F5F2',
		muted: '#ECE9E4',
		accent: '#E7E3DD',
		foreground: brandPalette.navy,
		mutedForeground: '#55626C',
		border: 'rgba(8, 36, 53, 0.10)',
		primary: brandPalette.olive,
		primaryForeground: brandPalette.navy,
		brand: '#4F6B2E',
		success: '#157F3D',
		warning: '#7A4F0F',
		warningDot: '#C98A1B',
		info: '#05667A',
		danger: '#B42318',
	},
	dark: {
		background: '#05141E',
		sidebar: '#061A26',
		card: '#0A1E2B',
		field: '#0F2430',
		muted: '#0F2430',
		accent: '#132A37',
		foreground: brandPalette.sandLight,
		mutedForeground: '#A8A39D',
		border: 'rgba(199, 195, 191, 0.12)',
		primary: brandPalette.oliveLight,
		primaryForeground: brandPalette.navy,
		brand: '#BCD291',
		success: '#7DD3A0',
		warning: '#F2D58A',
		warningDot: '#E9B949',
		info: '#8FD3E3',
		danger: '#F2867A',
	},
} as const;
