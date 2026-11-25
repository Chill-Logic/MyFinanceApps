import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { App } from '@capacitor/app';

import { AppLockStore } from '@/services/app-lock';
import { is_native } from '@/services/native';

/*
 * Telas "raiz": voltar nelas minimiza o app (convenção do Android), em vez de navegar pra trás —
 * o histórico ali costuma ter telas que o RouteGuard só redirecionaria de volta (ex.: o Entrar
 * depois de logar, ou uma tela privada depois do logout).
 */
const ROOT_PATHS = [ '/', '/entrar' ];

/*
 * Camadas do Radix abertas (Dialog, AlertDialog, Sheet, Popover, DropdownMenu, Select). Todas
 * fecham com Escape (DismissableLayer escuta keydown no document), então o botão voltar só
 * simula um Escape — fecha a de cima, igual o comportamento esperado de um modal nativo.
 */
const OPEN_LAYER_SELECTOR = [
	'[role="dialog"][data-state="open"]',
	'[role="alertdialog"][data-state="open"]',
	'[role="menu"][data-state="open"]',
	'[role="listbox"][data-state="open"]',
].join(', ');

/*
 * Botão/gesto "voltar" do Android. Sem isso, o Capacitor fecha o app direto na primeira vez,
 * mesmo com um modal aberto ou numa tela interna. Precisa morar dentro do <BrowserRouter>.
 */
const useNativeBackButton = () => {
	const navigate = useNavigate();
	const location = useLocation();

	/* O listener é registrado uma vez só; a ref evita ler um `pathname` congelado do 1º render. */
	const pathname_ref = useRef(location.pathname);
	pathname_ref.current = location.pathname;

	useEffect(() => {
		if (!is_native) return;

		const listener = App.addListener('backButton', ({ canGoBack }) => {
			/* Com a trava na tela, voltar só minimiza: fechar janela ou navegar aconteceria escondido por trás dela. */
			if (AppLockStore.isLocked()) {
				App.minimizeApp();
				return;
			}

			if (document.querySelector(OPEN_LAYER_SELECTOR)) {
				document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				return;
			}

			if (ROOT_PATHS.includes(pathname_ref.current)) {
				App.minimizeApp();
				return;
			}

			if (canGoBack) navigate(-1);
			else navigate('/', { replace: true });
		});

		return () => {
			listener.then((handle) => handle.remove());
		};
	}, [ navigate ]);
};

export default useNativeBackButton;
