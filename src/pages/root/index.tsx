import { Navigate } from 'react-router-dom';

import HomePage from '@/pages/home';

import { useCurrentUserContext } from '@/context/current_user';
import { is_native } from '@/services/native';

/*
 * Raiz (`/`): a Início pra quem está logado; pra visitante no navegador, a landing (HTML estático do index.html, ver
 * useLandingVisibility), então aqui não há nada a desenhar; no app da loja não existe landing, vai direto pro Entrar.
 */
const RootPage = () => {
	const { is_authenticated } = useCurrentUserContext();
	if (is_authenticated) return <HomePage />;
	if (is_native) return <Navigate to='/entrar' replace />;
	return <></>;
};

export default RootPage;
