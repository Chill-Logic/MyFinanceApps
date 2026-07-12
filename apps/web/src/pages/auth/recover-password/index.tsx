import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';

import { useRecoverPassword } from '@/hooks/api/auth/useRecoverPassword';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

const RecoverPasswordPage = () => {
	const navigate = useNavigate();
	const { toast } = useToast();

	const [ email, setEmail ] = useState('');
	const { mutate: recoverPasswordMutation, isPending } = useRecoverPassword();

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		recoverPasswordMutation({
			body: { email },
			onSuccess: (data) => {
				toast.success(data.message || 'E-mail com instruções enviado!');
				navigate('/auth/reset-password');
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Não foi possível enviar as instruções'));
			},
		});
	};

	return (
		<form onSubmit={onSubmit}>
			<div className='flex flex-col gap-y-8'>
				<p className='text-sm text-muted-foreground'>
					Informe o e-mail da sua conta. Enviaremos um link com o token para você redefinir a senha.
				</p>

				<TextInput
					type='email'
					placeholder='Insira aqui seu e-mail'
					label='E-mail'
					name='email'
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					disabled={isPending}
				/>

				<div className='flex flex-col gap-y-2'>
					<Button type='submit' isLoading={isPending} disabled={isPending || !email}>
						Enviar instruções
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

export default RecoverPasswordPage;
