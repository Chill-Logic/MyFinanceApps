import { ElementType, ReactNode } from 'react';

import classNames from 'classnames';

import { ITypographyStyle, TColor, TFontFamily, TFontSize, TFontWeight } from '@/types';

interface IProps {
	/**
     * Orientação do texto podendo ser: `center`, `left`, `right`
     *
     * @default left
     */
	align?: 'center' | 'left' | 'right';
	/**
     * Variante do tipo de texto. Cada tipo corresponde a um estilo diferente de tamanho de fonte, font-family ou peso.
     */
	fontSize?: TFontSize;
	variant?: TFontSize;
	/**
     * Cor do texto. Podendo ser `black`, `white`, `gray-100`, `gray-200`, `gray-300`, `gray-400`, `gray-500`, `gray-600`, `gray-700`, `gray-800`, `gray-900`, `primary-l`, `secondary-l`, `primary-m`, `secondary-m`, `primary-d`, `secondary-d`
     */
	color?: TColor;
	/**
     * Texto que será envolvido pelo Componente.
     */
	children: ReactNode;
	/**
     * className personalizada do componente
     */
	className?: string;
	/**
     * Tag do texto que será renderizado
     *
     * @default p
     */
	fontFamily?: TFontFamily;
	fontWeight?: TFontWeight;
	tag?: ElementType;
	/**
     * Props para adicionar classe de text-overflow ao texto
     */
	overflow?: boolean;
}

const Typography = (props: IProps) => {
	const {
		align = 'left',
		tag: Tag = 'p',
		className,
		variant = 'default',
		fontSize,
		fontWeight,
		fontFamily = 'noto-sans',
		color = 'black',
		children,
		overflow,
	} = props;

	const styles: ITypographyStyle = {
		fontSize: {
			'x-small': 'text-x-small',
			'small': 'text-small',
			'default': 'text-default',
			'medium': 'text-medium',
			'large': 'text-large',
			'x-large': 'text-x-large',
			'huge': 'text-huge',
			'x-huge': 'text-x-huge',
		},
		color: {
			'white': 'text-white',
			'black': 'text-black',
			'brand-main': 'text-brand-main',
			'brand-secondary': 'text-brand-secondary',
			'brand-tertiary': 'text-brand-tertiary',
			'basic-intense': 'text-basic-intense',
			'basic-link': 'text-basic-link',
			'basic-light': 'text-basic-light',
			'basic-placeholder': 'text-basic-placeholder',
			'feedback-info-light': 'text-feedback-info-light',
			'feedback-info-default': 'text-feedback-info-default',
			'feedback-info-dark': 'text-feedback-info-dark',
			'feedback-success-light': 'text-feedback-success-light',
			'feedback-success-default': 'text-feedback-success-default',
			'feedback-success-dark': 'text-feedback-success-dark',
			'feedback-warning-light': 'text-feedback-warning-light',
			'feedback-warning-default': 'text-feedback-warning-default',
			'feedback-warning-dark': 'text-feedback-warning-dark',
			'feedback-danger-light': 'text-feedback-danger-light',
			'feedback-danger-default': 'text-feedback-danger-default',
			'feedback-danger-dark': 'text-feedback-danger-dark',
			'stroke-default': 'text-stroke-default',
			'stroke-dark': 'text-stroke-dark',
			'background-light': 'text-background-light',
			'background-default': 'text-background-default',
			'background-input': 'text-background-input',
			'text-dark': 'text-text-dark',
			'text-default': 'text-text-default',
		},
		align: {
			'left': 'text-left',
			'center': 'text-center',
			'right': 'text-right',
		},
		overflow: 'text-ellipsis overflow-hidden whitespace-nowrap',
		fontWeight: {
			'thin': '!font-thin',
			'extra-light': '!font-extra-light',
			'light': '!font-light',
			'normal': '!font-normal',
			'medium': '!font-medium',
			'semi-bold': '!font-semi-bold',
			'bold': '!font-bold',
			'extra-bold': '!font-extra-bold',
			'heavy': '!font-heavy',
			'ultra-black': '!font-ultra-black',
		},
		fontFamily: {
			'noto-sans': '!font-noto-sans',
			'roboto': '!font-roboto',
		},
		variants: {
			'x-small': 'text-x-small font-normal',
			'small': 'text-small font-normal',
			'default': 'text-default font-normal',
			'medium': 'text-medium font-medium',
			'large': 'text-large font-medium',
			'x-large': 'text-x-large font-bold',
			'huge': 'text-huge font-bold',
			'x-huge': 'text-x-huge font-bold',
		},
	};

	return (
		<Tag
			className={
				classNames(
					styles.align[align],
					styles.color[color],
					styles.variants[variant],
					styles.fontFamily[fontFamily],
					{
						[styles.overflow]: overflow,
						[styles.fontWeight[fontWeight!]]: fontWeight,
						[styles.fontSize[fontSize!]]: fontSize
					},
					className,
				)
			}
		>
			{children}
		</Tag>
	);
};

export default Typography;