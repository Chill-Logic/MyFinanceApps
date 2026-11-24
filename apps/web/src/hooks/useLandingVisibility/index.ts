import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useCurrentUserContext } from '@/context/current_user';
import { is_native } from '@/services/native';

/*
 * A landing da raiz é HTML estático no index.html (#landing), fora do React, pra quem não roda JavaScript (o
 * verificador do Google, prévias de link) conseguir ler. Ela aparece com a classe `show-landing` no <html>: o script
 * do index.html liga na carga e este hook mantém a regra durante a navegação (entrar, sair, trocar de página).
 * Mesma regra nos dois lados: só na raiz, só sem sessão e nunca no app da loja.
 */
const useLandingVisibility = () => {
	const { pathname } = useLocation();
	const { is_authenticated } = useCurrentUserContext();
	const show = pathname === '/' && !is_authenticated && !is_native;

	useEffect(() => {
		document.documentElement.classList.toggle('show-landing', show);
	}, [ show ]);
};

export default useLandingVisibility;
