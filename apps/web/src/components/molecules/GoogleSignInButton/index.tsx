import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SocialLogin } from '@capgo/capacitor-social-login';
import { getApiErrorMessage } from '@myfinance/shared';

import { useGoogleSignIn } from '@/hooks/api/auth/useGoogleSignIn';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';
import { is_native } from '@/services/native';

/*
 * "Continuar com o Google" (backend #16, `POST /auth/google` com o ID token; a API acha a conta pelo Google,
 * senão vincula pelo e-mail, senão cria). Só aparece com `VITE_GOOGLE_CLIENT_ID` (o client ID OAuth "Web").
 *
 * - Navegador: Google Identity Services (script oficial, carregado só aqui). O botão é desenhado pelo próprio
 *   Google — o fluxo de popup só funciona com o botão deles.
 * - App (Capacitor): o Google bloqueia login dentro de WebView, então vai pelo plugin
 *   `@capgo/capacitor-social-login` (Credential Manager no Android). O `webClientId` é o MESMO client "Web" — é
 *   ele o público (`aud`) do ID token que a API valida. No Google Cloud, além dele, precisa existir um client
 *   "Android" com o package e o SHA-1 de cada chave que assina o app (debug, upload e a da Play App Signing).
 *   Aqui o botão é nosso, no visual do app.
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
export const is_google_sign_in_available = Boolean(CLIENT_ID);

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

/* O plugin nativo só precisa ser inicializado uma vez por execução do app. */
let native_ready: Promise<void> | null = null;
const initNative = () => {
	native_ready ??= SocialLogin.initialize({ google: { webClientId: CLIENT_ID!, skipAuthOnlyAuthorizationAfterSignIn: true } })
		.catch((error) => {
			native_ready = null;
			throw error;
		});
	return native_ready;
};

/* "G" colorido do Google (as cores oficiais da marca, exigidas nos botões de login com o Google). */
const GoogleLogo = () => (
	<svg aria-hidden='true' viewBox='0 0 48 48' className='size-5 shrink-0'>
		<path fill='#FFC107' d='M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z' />
		<path fill='#FF3D00' d='m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z' />
		<path fill='#4CAF50' d='M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z' />
		<path fill='#1976D2' d='M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z' />
	</svg>
);

const GoogleSignInButton = () => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { theme } = useTheme();
	const { toast } = useToast();
	const { mutate: googleSignIn, isPending } = useGoogleSignIn();
	const container_ref = useRef<HTMLDivElement>(null);
	const [ failed, setFailed ] = useState(false);
	const [ is_native_pending, setIsNativePending ] = useState(false);

	/* O callback do Google é registrado uma vez; a ref mantém o mais recente (navigate/login/toast). */
	const on_credential = useRef<(id_token?: string | null)=> void>(() => undefined);
	on_credential.current = (id_token) => {
		if (!id_token) return;
		googleSignIn({
			body: { id_token },
			onSuccess: ({ token, created }) => {
				login(token);
				if (created) toast.success('Conta criada com o Google');
				navigate('/');
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível entrar com o Google')),
		});
	};

	/* Navegador: desenha o botão do Google Identity Services. */
	useEffect(() => {
		if (!is_google_sign_in_available || is_native) return undefined;
		let cancelled = false;
		loadScript()
			.then(() => {
				const container = container_ref.current;
				const google_id = window.google?.accounts.id;
				if (cancelled || !container || !google_id) return;
				google_id.initialize({ client_id: CLIENT_ID!, callback: ({ credential }) => on_credential.current(credential), ux_mode: 'popup' });
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

	/* App: abre o seletor de contas do Android. Cancelar não é erro. */
	const signInNative = async() => {
		setIsNativePending(true);
		try {
			await initNative();
			const response = await SocialLogin.login({ provider: 'google', options: {} });
			const result = response.result as { idToken?: string | null };
			on_credential.current(result.idToken);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!/cancel/i.test(message)) toast.error('Não foi possível entrar com o Google');
		} finally {
			setIsNativePending(false);
		}
	};

	if (!is_google_sign_in_available || failed) return null;

	const divider = (
		<div className='flex items-center gap-3 text-xs text-muted-foreground' aria-hidden='true'>
			<span className='h-px flex-1 bg-border' />
			ou
			<span className='h-px flex-1 bg-border' />
		</div>
	);

	if (is_native) {
		const busy = is_native_pending || isPending;
		return (
			<>
				{divider}
				<button
					type='button'
					onClick={signInNative}
					disabled={busy}
					className={cn(
						'pressable flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-white text-[15px] font-semibold text-[#1F1F1F] transition-opacity dark:border-transparent',
						busy && 'opacity-60',
					)}
				>
					<GoogleLogo />
					{busy ? 'Entrando…' : 'Continuar com o Google'}
				</button>
			</>
		);
	}

	return (
		<>
			{divider}
			{/* Altura reservada (a do botão "large" do Google) pra o formulário não pular quando ele aparece. */}
			<div ref={container_ref} className='flex h-11 w-full justify-center' />
		</>
	);
};

export default GoogleSignInButton;
