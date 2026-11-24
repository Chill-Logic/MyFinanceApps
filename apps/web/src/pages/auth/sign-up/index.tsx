import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';

import { useSignIn } from '@/hooks/api/auth/useSignIn';
import { useSignUp } from '@/hooks/api/auth/useSignUp';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';

import { AUTH_MAX_PASSWORD, AuthField, AuthHeader, AuthLink, AuthSubmit, passwordProblem } from '@/components/molecules/AuthForm';
import GoogleSignInButton from '@/components/molecules/GoogleSignInButton';

type TSignUpForm = {
	name: string;
	email: string;
	password: string;
	password_confirmation: string;
};

const INITIAL_VALUES: TSignUpForm = { name: '', email: '', password: '', password_confirmation: '' };

/*
 * Cadastro. A API cria a conta (e a "Minha Carteira" principal) mas não devolve token — então, logo depois, entramos
 * sozinhos com o mesmo e-mail e senha, e a pessoa já cai na Home. Se esse login falhar, manda pro Login.
 */
const SignUpPage = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { login } = useCurrentUserContext();

	const [ values, setValues ] = useState<TSignUpForm>(INITIAL_VALUES);
	const { mutate: signUpMutation, isPending: is_sign_up_pending } = useSignUp();
	const { mutate: signInMutation, isPending: is_sign_in_pending } = useSignIn();
	const is_pending = is_sign_up_pending || is_sign_in_pending;

	const onChange = (key: keyof TSignUpForm, value: string) => {
		setValues({ ...values, [key]: value });
	};

	const signInAfterSignUp = () => {
		signInMutation({
			body: { email: values.email, password: values.password },
			onSuccess: ({ token }) => {
				login(token);
				toast.success('Conta criada. Que bom ter você aqui!');
				navigate('/');
			},
			onError: () => {
				toast.success('Conta criada! Entre com seu e-mail e senha.');
				navigate('/auth/sign-in');
			},
		});
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		const problem = passwordProblem(values.password, values.password_confirmation);
		if (problem) {
			toast.error(problem);
			return;
		}

		signUpMutation({
			body: { name: values.name, email: values.email, password: values.password },
			onSuccess: signInAfterSignUp,
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Verifique os campos e tente novamente'));
			},
		});
	};

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-3'>
			<AuthHeader title='Criar conta' subtitle='Leva menos de um minuto.' subtitleClassName='hidden md:block' />

			<AuthField
				id='name'
				type='text'
				label='Nome'
				autoComplete='name'
				required
				value={values.name}
				onChange={(e) => onChange('name', e.target.value)}
				disabled={is_pending}
			/>
			<AuthField
				id='email'
				type='email'
				label='E-mail'
				autoComplete='email'
				placeholder='voce@exemplo.com'
				required
				value={values.email}
				onChange={(e) => onChange('email', e.target.value)}
				disabled={is_pending}
			/>
			<AuthField
				id='password'
				revealable
				label={<>Senha <span className='opacity-75'>· mínimo 6 caracteres</span></>}
				autoComplete='new-password'
				maxLength={AUTH_MAX_PASSWORD}
				required
				value={values.password}
				onChange={(e) => onChange('password', e.target.value)}
				disabled={is_pending}
			/>
			<AuthField
				id='password_confirmation'
				type='password'
				label='Confirmar senha'
				autoComplete='new-password'
				maxLength={AUTH_MAX_PASSWORD}
				required
				value={values.password_confirmation}
				onChange={(e) => onChange('password_confirmation', e.target.value)}
				disabled={is_pending}
			/>

			<AuthSubmit isLoading={is_pending}>Criar conta</AuthSubmit>

			<GoogleSignInButton />

			<p className='px-3 text-center text-[12.5px] leading-normal text-muted-foreground'>
				Ao criar sua conta, você aceita os <Link to='/termos' className='font-semibold text-brand'>Termos de Uso</Link> e
				a <Link to='/privacidade' className='font-semibold text-brand'>Política de Privacidade</Link>.
			</p>

			<p className='pt-1 text-center text-sm text-muted-foreground'>
				Já tem conta? <AuthLink to='/auth/sign-in'>Entrar</AuthLink>
			</p>
		</form>
	);
};

export default SignUpPage;
