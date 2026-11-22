import { FormEvent, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';

import { useResetPassword } from '@/hooks/api/auth/useResetPassword';
import useToast from '@/hooks/useToast';

import { AUTH_MAX_PASSWORD, AuthBackLink, AuthField, AuthHeader, AuthSubmit, passwordProblem } from '@/components/molecules/AuthForm';

/**
 * Criar senha nova. O código chega pelo link do e-mail: o backend manda `/auth/change-password/<código>` (no
 * caminho); `/auth/reset-password?token=` continua valendo. O campo fica editável pra colar o código à mão.
 * O código vale 6 horas.
 */
const ResetPasswordPage = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { token: path_token } = useParams();
	const [ search_params ] = useSearchParams();

	const [ values, setValues ] = useState({
		token: path_token ?? search_params.get('token') ?? '',
		password: '',
		password_confirmation: '',
	});
	const { mutate: resetPasswordMutation, isPending } = useResetPassword();

	const onChange = (key: keyof typeof values, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		const problem = passwordProblem(values.password, values.password_confirmation);
		if (problem) {
			toast.error(problem);
			return;
		}

		resetPasswordMutation({
			body: values,
			onSuccess: () => {
				toast.success('Senha nova salva. Entre com ela.');
				navigate('/auth/sign-in');
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Não foi possível salvar a senha. O link pode ter expirado.'));
			},
		});
	};

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-3'>
			<AuthHeader title='Criar senha nova' subtitle='Escolha uma senha nova para a sua conta.' />

			<AuthField
				id='token'
				type='text'
				mono
				label='Código do e-mail'
				hint='Já vem preenchido quando você abre o link do e-mail.'
				autoComplete='one-time-code'
				spellCheck={false}
				required
				value={values.token}
				onChange={(e) => onChange('token', e.target.value)}
				disabled={isPending}
			/>
			<AuthField
				id='password'
				revealable
				label={<>Nova senha <span className='opacity-75'>· mínimo 6 caracteres</span></>}
				autoComplete='new-password'
				maxLength={AUTH_MAX_PASSWORD}
				required
				value={values.password}
				onChange={(e) => onChange('password', e.target.value)}
				disabled={isPending}
			/>
			<AuthField
				id='password_confirmation'
				type='password'
				label='Confirmar nova senha'
				autoComplete='new-password'
				maxLength={AUTH_MAX_PASSWORD}
				required
				value={values.password_confirmation}
				onChange={(e) => onChange('password_confirmation', e.target.value)}
				disabled={isPending}
			/>

			<AuthSubmit isLoading={isPending}>Salvar senha</AuthSubmit>

			<AuthBackLink />
		</form>
	);
};

export default ResetPasswordPage;
