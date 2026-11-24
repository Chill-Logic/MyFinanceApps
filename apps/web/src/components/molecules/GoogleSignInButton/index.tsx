import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';

import { useGoogleSignIn } from '@/hooks/api/auth/useGoogleSignIn';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';
import { is_native } from '@/services/native';

/*
 * "Continuar com o Google" (backend #16, `POST /auth/google` com o ID token). Usa o Google Identity Services
 * (script oficial, carregado só aqui e só quando precisa): o botão é desenhado pelo próprio Google — o fluxo de
 * popup só funciona com o botão deles — e devolve o ID token, que a API troca pelo nosso JWT. A API acha a conta
 * pelo Google, senão vincula pelo e-mail, senão cria.
 *
 * Só no navegador e só com `VITE_GOOGLE_CLIENT_ID`: sem ele, nada aparece. No app (Capacitor) o Google bloqueia
 * login dentro de WebView — lá vai precisar de um plugin nativo, ainda não feito.
 */

type TGoogleCredentialResponse = { credential?: string };
type TGoogleId = {
	initialize: (options: { client_id: string; callback: (response: TGoogleCredentialResponse)=> void; ux_mode?: 'popup' })=> void;
	renderButton: (element: HTMLElement, options: Record<string, string | number>)=> void;
};
declare global {
	interface Window { google?: { accounts: { id: TGoogleId } } }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const is_google_sign_in_available = Boolean(CLIENT_ID) && !is_native;

let script_promise: Promise<void> | null = null;
const loadScript = () => {
	if (window.google?.accounts?.id) return Promise.resolve();
	script_promise ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SCRIPT_SRC;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			script_promise = null;
			reject(new Error('google-script'));
		};
		document.head.appendChild(script);
	});
	return script_promise;
};

const GoogleSignInButton = () => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { theme } = useTheme();
	const { toast } = useToast();
	const { mutate: googleSignIn } = useGoogleSignIn();
	const container_ref = useRef<HTMLDivElement>(null);
	const [ failed, setFailed ] = useState(false);

	/* O callback do Google é registrado uma vez; a ref mantém o mais recente (navigate/login/toast). */
	const on_credential = useRef<(response: TGoogleCredentialResponse)=> void>(() => undefined);
	on_credential.current = ({ credential }) => {
		if (!credential) return;
		googleSignIn({
			body: { id_token: credential },
			onSuccess: ({ token, created }) => {
				login(token);
				if (created) toast.success('Conta criada com o Google');
				navigate('/');
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível entrar com o Google')),
		});
	};

	useEffect(() => {
		if (!is_google_sign_in_available) return;
		let cancelled = false;
		loadScript()
			.then(() => {
				const container = container_ref.current;
				const google_id = window.google?.accounts.id;
				if (cancelled || !container || !google_id) return;
				google_id.initialize({ client_id: CLIENT_ID!, callback: (response) => on_credential.current(response), ux_mode: 'popup' });
				container.innerHTML = '';
				google_id.renderButton(container, {
					type: 'standard',
					theme: theme === 'dark' ? 'filled_black' : 'outline',
					size: 'large',
					shape: 'pill',
					text: 'continue_with',
					logo_alignment: 'center',
					locale: 'pt-BR',
					width: Math.min(container.offsetWidth || 400, 400),
				});
			})
			.catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
		};
	}, [ theme ]);

	if (!is_google_sign_in_available || failed) return null;

	return (
		<>
			<div className='flex items-center gap-3 text-xs text-muted-foreground' aria-hidden='true'>
				<span className='h-px flex-1 bg-border' />
				ou
				<span className='h-px flex-1 bg-border' />
			</div>
			{/* Altura reservada (a do botão "large" do Google) pra o formulário não pular quando ele aparece. */}
			<div ref={container_ref} className='flex h-11 w-full justify-center' />
		</>
	);
};

export default GoogleSignInButton;
