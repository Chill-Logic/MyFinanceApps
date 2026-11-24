import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';
import { isAxiosError } from 'axios';

import { useLookupEmail } from '@/hooks/api/auth/useLookupEmail';
import { useSignIn } from '@/hooks/api/auth/useSignIn';
import { useSignUp } from '@/hooks/api/auth/useSignUp';
import usePolicyVersions from '@/hooks/usePolicyVersions';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { forgetGoogleAccount, getRememberedGoogleAccount } from '@/util/rememberedGoogleAccount';

import { AUTH_MAX_PASSWORD, AuthField, AuthHeader, AuthLink, AuthSubmit, passwordProblem } from '@/components/molecules/AuthForm';
import GoogleSignInButton, { is_google_sign_in_available } from '@/components/molecules/GoogleSignInButton';

/*
 * Entrar e criar conta num fluxo só, em duas etapas (mockup v3 "Login em 2 etapas"):
 *   1. o e-mail (ou "Continuar com o Google"); o `POST /auth/lookup` (backend #30) diz se tem conta e como ela entra;
 *   2. senha (conta com senha) · "Continuar com o Google" (conta só do Google) · nome + senha (e-mail sem conta).
 * Com uma conta do Google lembrada neste aparelho, a tela já abre em "Continuar como <nome>".
 * Se a consulta falhar por outro motivo que não o limite de tentativas (ex.: backend ainda sem a rota), cai no login
 * antigo: pede a senha e oferece "Criar conta".
 */

type TStep = 'remembered' | 'email' | 'password' | 'google' | 'signup';

const STEP_COPY: Record<TStep, { title: string; subtitle: string }> = {
	remembered: { title: 'Que bom te ver de novo', subtitle: 'Entre com a conta que você usou da última vez.' },
	email: { title: 'Entrar ou criar conta', subtitle: 'Use o seu e-mail ou a sua conta Google.' },
	password: { title: 'Digite a sua senha', subtitle: 'Falta só a senha.' },
	google: { title: 'Entre com o Google', subtitle: 'Sua conta não tem senha.' },
	signup: { title: 'Criar sua conta', subtitle: 'Esse e-mail ainda não tem conta. Leva menos de um minuto.' },
};

const LegalNote = ({ signup }: { signup: boolean }) => (
	<p className='px-3 pt-1 text-center text-xs leading-normal text-muted-foreground'>
		{signup ? 'Ao criar sua conta, você aceita' : 'Ao continuar, você concorda com'} os <Link to='/termos' className='font-semibold'>Termos de Uso</Link> e
		a <Link to='/privacidade' className='font-semibold'>Política de Privacidade</Link>.
	</p>
);

/* Pílula com o e-mail escolhido e "Trocar" (volta pra 1ª etapa). */
const EmailChip = ({ email, onChange }: { email: string; onChange: ()=> void }) => (
	<div className='flex items-center gap-2.5 rounded-full border border-input bg-secondary p-2'>
		<span aria-hidden='true' className='flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-primary text-xs font-bold text-sand-light'>
			{email.charAt(0).toUpperCase()}
		</span>
		<span className='min-w-0 flex-1 truncate text-sm'>{email}</span>
		<button type='button' onClick={onChange} className='pressable px-2.5 text-[13px] font-bold text-brand'>Trocar</button>
	</div>
);

const AuthFlow = ({ intent }: { intent: 'sign-in' | 'sign-up' }) => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { toast } = useToast();
	const { accepted } = usePolicyVersions();

	const [ remembered, setRemembered ] = useState(() => (intent === 'sign-in' && is_google_sign_in_available ? getRememberedGoogleAccount() : null));
	const [ step, setStep ] = useState<TStep>(remembered ? 'remembered' : 'email');
	/* Consulta indisponível: senha + "Criar conta", como o login antigo. */
	const [ legacy, setLegacy ] = useState(false);
	const [ email, setEmail ] = useState('');
	const [ name, setName ] = useState('');
	const [ password, setPassword ] = useState('');

	const { mutate: lookup, isPending: is_looking_up } = useLookupEmail();
	const { mutate: signIn, isPending: is_signing_in } = useSignIn();
	const { mutate: signUp, isPending: is_signing_up } = useSignUp();
	const busy = is_looking_up || is_signing_in || is_signing_up;

	const goTo = (next: TStep) => {
		setPassword('');
		setStep(next);
	};

	const enter = (token: string, message?: string) => {
		login(token);
		if (message) toast.success(message);
		navigate('/');
	};

	const onEmail = (event: FormEvent) => {
		event.preventDefault();
		const value = email.trim();
		if (!value) return;
		lookup({
			body: { email: value },
			onSuccess: ({ exists, has_password }) => {
				setLegacy(false);
				if (!exists) goTo('signup');
				else goTo(has_password ? 'password' : 'google');
			},
			onError: (error) => {
				if (isAxiosError(error) && error.response?.status === 429) {
					toast.error('Muitas tentativas. Espere um minuto e tente de novo.');
					return;
				}
				setLegacy(true);
				goTo('password');
			},
		});
	};

	const onPassword = (event: FormEvent) => {
		event.preventDefault();
		signIn({
			body: { email: email.trim(), password },
			onSuccess: ({ token }) => enter(token),
			onError: (error) => toast.error(getApiErrorMessage(error, 'E-mail ou senha inválidos')),
		});
	};

	/* A API cria a conta mas não devolve token: entra logo em seguida com a mesma senha. */
	const onSignUp = (event: FormEvent) => {
		event.preventDefault();
		const problem = passwordProblem(password, password);
		if (problem) {
			toast.error(problem);
			return;
		}
		const body = { name: name.trim(), email: email.trim(), password };
		signUp({
			body: { ...body, accepted_policies: accepted },
			onSuccess: () => signIn({
				body: { email: body.email, password },
				onSuccess: ({ token }) => enter(token, 'Conta criada. Que bom ter você aqui!'),
				onError: () => {
					toast.success('Conta criada! Entre com seu e-mail e senha.');
					goTo('password');
				},
			}),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Verifique os campos e tente novamente')),
		});
	};

	const copy = step === 'email' && intent === 'sign-up'
		? { title: 'Criar conta', subtitle: 'Comece pelo seu e-mail.' }
		: STEP_COPY[step];
	const header = <AuthHeader title={copy.title} subtitle={copy.subtitle} subtitleClassName='hidden md:block' />;
	const chip = <EmailChip email={email.trim()} onChange={() => goTo('email')} />;

	if (step === 'remembered' && remembered) {
		return (
			<div className='flex flex-col gap-3'>
				{header}
				<GoogleSignInButton account={remembered} divider={false} />
				<button
					type='button'
					onClick={() => {
						forgetGoogleAccount();
						setRemembered(null);
						goTo('email');
					}}
					className='pressable self-center px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'
				>
					Usar outra conta
				</button>
				<LegalNote signup={false} />
			</div>
		);
	}

	if (step === 'password') {
		return (
			<form onSubmit={onPassword} className='flex flex-col gap-3'>
				{header}
				{chip}
				<AuthField
					id='password'
					revealable
					label='Senha'
					aside={<Link to='/esqueci-a-senha' className='text-[13px] text-muted-foreground transition-colors hover:text-foreground'>Esqueci a senha</Link>}
					autoComplete='current-password'
					autoFocus
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={busy}
				/>
				<AuthSubmit isLoading={is_signing_in}>Entrar</AuthSubmit>
				{legacy && (
					<p className='pt-1 text-center text-sm text-muted-foreground'>
						Primeira vez aqui? <button type='button' onClick={() => goTo('signup')} className='font-bold text-brand'>Criar conta</button>
					</p>
				)}
				<LegalNote signup={false} />
			</form>
		);
	}

	if (step === 'google') {
		return (
			<div className='flex flex-col gap-3'>
				{header}
				{chip}
				<GoogleSignInButton divider={false} />
				<LegalNote signup={false} />
			</div>
		);
	}

	if (step === 'signup') {
		return (
			<form onSubmit={onSignUp} className='flex flex-col gap-3'>
				{header}
				{chip}
				<AuthField
					id='name'
					type='text'
					label='Nome'
					autoComplete='name'
					autoFocus
					required
					value={name}
					onChange={(e) => setName(e.target.value)}
					disabled={busy}
				/>
				<AuthField
					id='password'
					revealable
					label={<>Senha <span className='opacity-75'>· mínimo 6 caracteres</span></>}
					autoComplete='new-password'
					maxLength={AUTH_MAX_PASSWORD}
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={busy}
				/>
				<AuthSubmit isLoading={is_signing_up || is_signing_in}>Criar conta</AuthSubmit>
				<LegalNote signup />
			</form>
		);
	}

	return (
		<form onSubmit={onEmail} className='flex flex-col gap-3'>
			{header}
			<AuthField
				id='email'
				type='email'
				label='E-mail'
				autoComplete='email'
				placeholder='voce@exemplo.com'
				autoFocus
				required
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				disabled={busy}
			/>
			<AuthSubmit isLoading={is_looking_up}>Continuar</AuthSubmit>
			<GoogleSignInButton />
			{intent === 'sign-up' && (
				<p className='pt-1 text-center text-sm text-muted-foreground'>Já tem conta? <AuthLink to='/entrar'>Entrar</AuthLink></p>
			)}
			<LegalNote signup={intent === 'sign-up'} />
		</form>
	);
};

export default AuthFlow;
