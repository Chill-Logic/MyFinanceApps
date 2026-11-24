import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';

import { useSignIn } from '@/hooks/api/auth/useSignIn';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';

import { AuthField, AuthHeader, AuthLink, AuthSubmit } from '@/components/molecules/AuthForm';
import GoogleSignInButton from '@/components/molecules/GoogleSignInButton';

const INITIAL_VALUES = { email: '', password: '' };

const SignInPage = () => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { toast } = useToast();

	const [ values, setValues ] = useState(INITIAL_VALUES);
	const { mutate: signInMutation, isPending: is_sign_in_pending } = useSignIn();

	const onChange = (key: keyof typeof INITIAL_VALUES, value: string) => {
		setValues({ ...values, [key]: value });
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		signInMutation({
			body: values,
			onSuccess: ({ token }) => {
				login(token);
				navigate('/');
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'E-mail ou senha inválidos'));
			},
		});
	};

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-3'>
			<AuthHeader title='Entrar' subtitle='Use o e-mail da sua conta.' subtitleClassName='hidden lg:block' />

			<AuthField
				id='email'
				type='email'
				label='E-mail'
				autoComplete='email'
				placeholder='voce@exemplo.com'
				required
				value={values.email}
				onChange={(e) => onChange('email', e.target.value)}
				disabled={is_sign_in_pending}
			/>
			<AuthField
				id='password'
				revealable
				label='Senha'
				aside={(
					<Link to='/esqueci-a-senha' className='hidden text-[13px] text-muted-foreground transition-colors hover:text-foreground md:inline'>
						Esqueci a senha
					</Link>
				)}
				autoComplete='current-password'
				required
				value={values.password}
				onChange={(e) => onChange('password', e.target.value)}
				disabled={is_sign_in_pending}
			/>

			<AuthSubmit isLoading={is_sign_in_pending}>Entrar</AuthSubmit>

			<GoogleSignInButton />

			{/* Celular: os dois atalhos numa linha só, embaixo do botão (como no mockup). */}
			<div className='flex justify-between px-1 pt-1 text-sm md:hidden'>
				<Link to='/esqueci-a-senha' className='text-muted-foreground'>Esqueci a senha</Link>
				<AuthLink to='/criar-conta'>Criar conta</AuthLink>
			</div>
			<p className='hidden pt-2 text-center text-sm text-muted-foreground md:block'>
				Primeira vez aqui? <AuthLink to='/criar-conta'>Criar conta</AuthLink>
			</p>
			{/* O "Continuar com o Google" também cria conta: por isso o aviso fica no Entrar também. */}
			<p className='px-3 pt-1 text-center text-xs leading-normal text-muted-foreground'>
				Ao continuar, você concorda com os <Link to='/termos' className='font-semibold'>Termos de Uso</Link> e
				a <Link to='/privacidade' className='font-semibold'>Política de Privacidade</Link>.
			</p>
		</form>
	);
};

export default SignInPage;
