import { ReactNode } from 'react';

export type TError<T> = Partial<Record<keyof T, { message: string }>>;

export interface IPath {
	id: string;
	display?: string;
	path: string;
	element: React.LazyExoticComponent<()=> JSX.Element>;
	template: React.LazyExoticComponent<(props: ITemplateProps)=> JSX.Element>;
	isMainPath?: boolean;
}

export interface ITemplateProps {
	children: ReactNode;
}
