import { Navigate, useLocation } from 'react-router-dom';

import { SECTION_SLUGS, TAB_SLUGS } from '@/util/routeSlugs';

import { IPath } from '@/types';

import BlankTemplate from '@/components/templates/Blank';

/*
 * Endereços antigos (em inglês, até 2026-11) redirecionando pros novos, em português. Continuam valendo pra favoritos,
 * links já enviados, versões antigas do app e, principalmente, o e-mail de redefinição de senha, que o backend monta
 * com `/auth/change-password/<código>`. Os parâmetros antigos (`?section=`, `?tab=`, `?token=`) também são traduzidos.
 */
const translate = (pathname: string, search: URLSearchParams): string => {
	const path = pathname.replace(/\/+$/, '');
	const query = (params: Record<string, string | undefined>) => {
		const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
		return entries.length ? `?${ new URLSearchParams(entries).toString() }` : '';
	};

	const change_password = path.match(/^\/auth\/change-password\/(.+)$/);
	if (change_password) return `/redefinir-senha/${ change_password[1] }`;
	const bank = path.match(/^\/accounts\/banks\/(.+)$/);
	if (bank) return `/contas/bancos/${ bank[1] }`;

	switch (path) {
		case '/auth/sign-in': return '/entrar';
		case '/auth/sign-up': return '/criar-conta';
		case '/auth/recover-password': return '/esqueci-a-senha';
		case '/auth/reset-password': return `/redefinir-senha${ query({ codigo: search.get('token') ?? undefined }) }`;
		case '/settings': return `/configuracoes${ query({ secao: SECTION_SLUGS[search.get('section') as keyof typeof SECTION_SLUGS] }) }`;
		case '/accounts': return `/contas${ query({ aba: TAB_SLUGS[search.get('tab') as keyof typeof TAB_SLUGS] }) }`;
		case '/wallets': return '/carteiras';
		case '/wallets/invites': return '/carteiras/convites';
		default: return '/';
	}
};

const LegacyRedirect = () => {
	const { pathname, search } = useLocation();
	return <Navigate to={translate(pathname, new URLSearchParams(search))} replace />;
};

const OLD_PATHS = [
	'auth/sign-in', 'auth/sign-up', 'auth/recover-password', 'auth/reset-password', 'auth/change-password/:token',
	'settings', 'accounts', 'accounts/banks/:id', 'wallets', 'wallets/invites',
];

export const LegacyPaths: IPath[] = OLD_PATHS.map((path) => ({
	id: `legacy:${ path }`,
	path,
	element: LegacyRedirect,
	template: BlankTemplate,
}));
