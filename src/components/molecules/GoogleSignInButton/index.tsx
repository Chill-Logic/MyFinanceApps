import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SocialLogin } from '@capgo/capacitor-social-login';
import { getApiErrorMessage } from '@myfinance/shared';

import { useGoogleSignIn } from '@/hooks/api/auth/useGoogleSignIn';
import usePolicyVersions from '@/hooks/usePolicyVersions';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';
import { is_native } from '@/services/native';
import { rememberGoogleAccount, type TRememberedGoogleAccount } from '@/util/rememberedGoogleAccount';

import { FIELD_SURFACE } from '@/components/ui/field';

/*
 * "Continuar com o Google" (backend #16, `POST /auth/google` com o ID token; a API acha a conta pelo Google,
 * senão vincula pelo e-mail, senão cria). Só aparece com `VITE_GOOGLE_CLIENT_ID` (o client ID OAuth "Web").
 *
 * - Navegador: Google Identity Services (script oficial, carregado só aqui). O fluxo de popup só funciona com o
 *   botão DELES, mas o desenho dele destoava do app (caixa branca no tema escuro, outra altura) e piscava a cada troca
 *   de tema, porque precisava ser redesenhado. Então o que aparece é o NOSSO botão, e o do Google fica por cima,
 *   invisível (opacidade ~0), esticado do tamanho do nosso, só pra receber o clique. Ele é desenhado uma vez só.
 * - App (Capacitor): o Google bloqueia login dentro de WebView, então vai pelo plugin
 *   `@capgo/capacitor-social-login` (Credential Manager no Android). O `webClientId` é o MESMO client "Web" — é
 *   ele o público (`aud`) do ID token que a API valida. No Google Cloud, além dele, precisa existir um client
 *   "Android" com o package e o SHA-1 de cada chave que assina o app (debug, upload e a da Play App Signing).
 *   Aqui o botão é nosso, no visual do app.
 * - Conta lembrada (`account`): o mesmo botão vira "Continuar como <nome>", com a foto — a última conta do Google
 *   usada neste aparelho (`util/rememberedGoogleAccount`). O clique continua abrindo a escolha de conta do Google.
 * - Ao criar a conta, manda as versões dos Termos e da Política que a pessoa viu (`accepted_policies`, backend #26).
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

interface IProps {
	account?: TRememberedGoogleAccount | null;
	/* O "ou" em cima (quando vem logo depois de outro jeito de entrar). */
	divider?: boolean;
}

const Avatar = ({ account }: { account: TRememberedGoogleAccount }) => {
	const [ broken, setBroken ] = useState(false);
	if (account.picture && !broken) {
		return <img src={account.picture} alt='' referrerPolicy='no-referrer' onError={() => setBroken(true)} className='size-11 shrink-0 rounded-full object-cover' />;
	}
	return (
		<span aria-hidden='true' className='flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-primary text-base font-bold text-sand-light'>
			{account.name.charAt(0).toUpperCase()}
		</span>
	);
};

const GoogleSignInButton = ({ account = null, divider: with_divider = true }: IProps) => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { toast } = useToast();
	const { mutate: googleSignIn, isPending } = useGoogleSignIn();
	const { accepted } = usePolicyVersions();
	const overlay_ref = useRef<HTMLDivElement>(null);
	const [ failed, setFailed ] = useState(false);
	const [ is_native_pending, setIsNativePending ] = useState(false);

	/* O callback do Google é registrado uma vez; a ref mantém o mais recente (navigate/login/toast). */
	const on_credential = useRef<(id_token?: string | null)=> void>(() => undefined);
	on_credential.current = (id_token) => {
		if (!id_token) return;
		googleSignIn({
			body: { id_token, accepted_policies: accepted },
			onSuccess: ({ token, created }) => {
				rememberGoogleAccount(id_token);
				login(token);
				if (created) toast.success('Conta criada com o Google');
				navigate('/');
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível entrar com o Google')),
		});
	};

	/*
	 * Navegador: desenha o botão do Google, invisível, por cima do nosso. O botão deles tem no máximo 400px de
	 * largura e altura fixa: ele é desenhado em 400px e esticado (scale) até cobrir o nosso, pra qualquer ponto do
	 * nosso botão cair num clique dele. Sem dependência de tema: o desenho dele não aparece.
	 */
	useEffect(() => {
		if (!is_google_sign_in_available || is_native) return undefined;
		let cancelled = false;
		let observer: ResizeObserver | null = null;
		loadScript()
			.then(() => {
				const overlay = overlay_ref.current;
				const google_id = window.google?.accounts.id;
				if (cancelled || !overlay || !google_id) return;
				google_id.initialize({ client_id: CLIENT_ID!, callback: ({ credential }) => on_credential.current(credential), ux_mode: 'popup' });
				const inner = document.createElement('div');
				inner.style.transformOrigin = 'top left';
				overlay.replaceChildren(inner);
				google_id.renderButton(inner, { type: 'standard', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR', width: 400 });
				const fit = () => {
					const box = overlay.getBoundingClientRect();
					const rendered = inner.getBoundingClientRect();
					const base_width = rendered.width / (Number(inner.dataset.sx) || 1);
					const base_height = rendered.height / (Number(inner.dataset.sy) || 1);
					if (!base_width || !base_height) return;
					const sx = box.width / base_width;
					const sy = box.height / base_height;
					inner.dataset.sx = String(sx);
					inner.dataset.sy = String(sy);
					inner.style.transform = `scale(${ sx }, ${ sy })`;
				};
				observer = new ResizeObserver(fit);
				observer.observe(overlay);
				observer.observe(inner);
			})
			.catch(() => !cancelled && setFailed(true));
		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	}, []);

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

	const divider_line = (
		<div className='flex items-center gap-3 text-xs text-muted-foreground' aria-hidden='true'>
			<span className='h-px flex-1 bg-border' />
			ou
			<span className='h-px flex-1 bg-border' />
		</div>
	);

	const busy = is_native_pending || isPending;
	const face = account
		? (
			<>
				<Avatar account={account} />
				<span className='flex min-w-0 flex-1 flex-col text-left'>
					<span className='truncate text-base font-bold'>{busy ? 'Entrando…' : `Continuar como ${ account.name }`}</span>
					<span className='truncate text-[13px] font-normal text-muted-foreground'>{account.email}</span>
				</span>
				<GoogleLogo />
			</>
		)
		: (
			<>
				<GoogleLogo />
				{busy ? 'Entrando…' : 'Continuar com o Google'}
			</>
		);
	const look = cn(
		FIELD_SURFACE,
		account
			? 'flex h-auto min-h-[68px] w-full items-center gap-3.5 rounded-3xl py-3 pl-3 pr-[18px] text-foreground'
			: 'flex h-[52px] w-full items-center justify-center gap-3 rounded-full text-[15px] font-semibold text-foreground md:h-[54px] xl:h-[52px]',
		busy && 'opacity-60',
	);
	const divider = with_divider ? divider_line : null;

	if (is_native) {
		return (
			<>
				{divider}
				<button type='button' onClick={signInNative} disabled={busy} className={cn('pressable', look)}>{face}</button>
			</>
		);
	}

	return (
		<>
			{divider}
			{/* O nosso botão, só visual; quem recebe o clique é o do Google, invisível por cima (ver o efeito acima). */}
			<div className={cn('group relative', look)}>
				<span className={cn('pointer-events-none flex items-center transition-opacity group-hover:opacity-80', account ? 'w-full gap-3.5' : 'gap-3')}>{face}</span>
				<div
					ref={overlay_ref}
					aria-label='Continuar com o Google'
					className={cn('absolute inset-0 overflow-hidden opacity-[0.01]', account ? 'rounded-3xl' : 'rounded-full', busy && 'pointer-events-none')}
				/>
			</div>
		</>
	);
};

export default GoogleSignInButton;
