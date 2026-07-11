import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';
import { Eye, EyeOff } from 'lucide-react';

import { useResetPassword } from '@/hooks/api/auth/useResetPassword';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

/**
 * Redefinição de senha. O token chega pelo link do e-mail (`?token=...`) — prefilamos a partir da
 * URL, mas deixamos o campo editável pra dar pra validar o fluxo colando o token manualmente
 * (web-first). Confirmação de senha é validada no client antes de bater na API (que também valida).
 */
const ResetPasswordPage = () => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const [ search_params ] = useSearchParams();

	const [ values, setValues ] = useState({
		token: search_params.get('token') ?? '',
		password: '',
		password_confirmation: '',
	});
	const [ show_password, setShowPassword ] = useState(false);
	const { mutate: resetPasswordMutation, isPending } = useResetPassword();

	const onChange = (key: keyof typeof values, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (values.password !== values.password_confirmation) {
			toast.error('As senhas não coincidem');
			return;
		}

		resetPasswordMutation({
			body: values,
			onSuccess: (data) => {
				toast.success(data.message || 'Senha alterada com sucesso!');
				navigate('/auth/sign-in');
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Não foi possível redefinir a senha'));
			},
		});
	};

	const is_submit_disabled = isPending || !values.token || !values.password || !values.password_confirmation;

	return (
		<form onSubmit={onSubmit}>
			<div className='flex flex-col gap-y-8'>
				<div className='flex w-full flex-col gap-y-4'>
					<TextInput
						type='text'
						placeholder='Cole aqui o token recebido por e-mail'
						label='Token'
						name='token'
						value={values.token}
						onChange={(e) => onChange('token', e.target.value)}
						disabled={isPending}
					/>
					<TextInput
						type={show_password ? 'text' : 'password'}
						placeholder='Insira a nova senha'
						label='Nova senha'
						name='password'
						value={values.password}
						onChange={(e) => onChange('password', e.target.value)}
						disabled={isPending}
						rightIconComponent={show_password ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
						rightBtnAction={() => setShowPassword(!show_password)}
					/>
					<TextInput
						type={show_password ? 'text' : 'password'}
						placeholder='Confirme a nova senha'
						label='Confirmar senha'
						name='password_confirmation'
						value={values.password_confirmation}
						onChange={(e) => onChange('password_confirmation', e.target.value)}
						disabled={isPending}
					/>
				</div>

				<div className='flex flex-col gap-y-2'>
					<Button type='submit' isLoading={isPending} disabled={is_submit_disabled}>
						Redefinir senha
					</Button>
					<Button
						variant='secondary'
						type='button'
						disabled={isPending}
						onClick={() => navigate('/auth/sign-in')}
					>
						Voltar para o login
					</Button>
				</div>
			</div>
		</form>
	);
};

export default ResetPasswordPage;
