import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useCurrentUserContext } from '@/context/current_user';

/*
 * Lê `is_authenticated` do contexto (estado de verdade, atualizado só por `login`/`logout`), não
 * `AuthStorage.getToken()` direto — `CurrentUserProvider` fica acima do `<Router/>` em `App.tsx`,
 * e `RouteGuard` é passado como `children` desde lá. Um componente que só lê `children` sem
 * consumir o contexto não é "avisado" pelo React quando o provider muda de estado sozinho (o
 * React pula re-render de quem recebeu a mesma referência de `children`, a não ser que o
 * componente consuma o contexto que mudou) — era por isso que o "Sair" limpava o token mas a tela
 * continuava do mesmo jeito, sem redirecionar: o guard nunca re-executava pra notar que o token
 * tinha sumido. Consumindo o contexto aqui, o React garante o re-render deste componente sempre
 * que `login`/`logout` mudar o estado do provider.
 */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
	const { is_authenticated } = useCurrentUserContext();

	if (!is_authenticated) {
		return <Navigate to='/auth/sign-in' replace />;
	}
	return children;
};

export const RequireGuest = ({ children }: { children: ReactNode }) => {
	const { is_authenticated } = useCurrentUserContext();

	if (is_authenticated) {
		return <Navigate to='/' replace />;
	}
	return children;
};

interface IRouteGuardProps {
	children: ReactNode;
	isPrivate?: boolean;
	isGuestOnly?: boolean;
}

export const RouteGuard = ({ children, isPrivate, isGuestOnly }: IRouteGuardProps) => {
	if (isPrivate) {
		return <RequireAuth>{children}</RequireAuth>;
	}
	if (isGuestOnly) {
		return <RequireGuest>{children}</RequireGuest>;
	}
	return children;
};
