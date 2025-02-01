import { lazy, ReactNode } from 'react';

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

export const DefaultPaths: IPath[] = [
	{
		id: 'home',
		display: 'Início',
		path: '/',
		element: lazy(() => import('@/pages/home')),
		template: lazy(() => import('@/components/templates/default')),
		isMainPath: true,
	}
];