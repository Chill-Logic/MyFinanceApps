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

/**
 * Papéis semânticos por tema, derivados da paleta acima. Mapeamento confirmado a partir do uso real
 * das classes `dark:` no webapp (não dos nomes dos tokens, que são contraintuitivos: "stroke-dark" é
 * o stroke do tema claro, por exemplo).
 */
export const Theme = {
	light: {
		text: colors['text-dark'],
		background: colors['background-light'],
		border: colors['stroke-dark'],
		placeholder: colors['basic-placeholder'],
		error: colors['feedback-danger-default'],
	},
	dark: {
		text: colors['text-default'],
		background: colors['background-default'],
		border: colors['stroke-default'],
		placeholder: colors['basic-placeholder'],
		error: colors['feedback-danger-default'],
	},
} as const;
