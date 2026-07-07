import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { AuthStorage } from '@/services/storage';

export const RequireAuth = ({ children }: { children: ReactNode }) => {
	if (!AuthStorage.getToken()) {
		return <Navigate to='/auth/sign-in' replace />;
	}
	return children;
};

export const RequireGuest = ({ children }: { children: ReactNode }) => {
	if (AuthStorage.getToken()) {
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
