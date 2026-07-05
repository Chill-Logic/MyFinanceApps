import { ReactNode } from 'react';

import { Tokens } from '@/util';

export * from '@myfinance/shared';

export type TError<T> = Partial<Record<keyof T, { message: string }>>;
export type TFontSize = keyof typeof Tokens.fontSize;
export type TColor = keyof typeof Tokens.colors | 'white' | 'black';
export type TFontWeight = keyof typeof Tokens.fontWeight;
export type TFontFamily = keyof typeof Tokens.fontFamily;

export interface IPath {
	id: string;
	display?: string;
	path: string;
	element: React.LazyExoticComponent<()=> JSX.Element>;
	template: React.LazyExoticComponent<(props: ITemplateProps)=> JSX.Element>;
	isMainPath?: boolean;
}

export interface ITypographyStyle {
	overflow: string;
	align: Record<'center' | 'left' | 'right', string>;
	fontSize: Record<TFontSize, string>;
	color: Record<TColor, string>;
	fontWeight: Record<TFontWeight, string>;
	fontFamily: Record<TFontFamily, string>;
	variants: Record<TFontSize, string>;
}

export interface ITemplateProps {
	children: ReactNode;
}
