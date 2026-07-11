import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Eye, EyeOff } from 'lucide-react';

import { useSignIn } from '@/hooks/api/auth/useSignIn';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

const INITIAL_VALUES = { email: '', password: '' };

const SignInPage = () => {
	const navigate = useNavigate();
	const { login } = useCurrentUserContext();
	const { toast } = useToast();

	const [ values, setValues ] = useState(INITIAL_VALUES);
	const [ show_password, setShowPassword ] = useState(false);
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
			onError: () => {
				toast.error('E-mail ou senha inválidos');
			},
		});
	};

	return (
		<form onSubmit={onSubmit}>
			<div className='flex flex-col gap-y-8'>
				<div className='w-full flex flex-col gap-y-4'>
					<TextInput
						type='email'
						placeholder='Insira aqui seu e-mail'
						label='E-mail'
						name='email'
						value={values.email}
						onChange={(e) => onChange('email', e.target.value)}
						disabled={is_sign_in_pending}
					/>
					<TextInput
						type={show_password ? 'text' : 'password'}
						placeholder='Insira aqui sua senha'
						label='Senha'
						name='password'
						value={values.password}
						onChange={(e) => onChange('password', e.target.value)}
						disabled={is_sign_in_pending}
						rightIconComponent={show_password ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
						rightBtnAction={() => setShowPassword(!show_password)}
					/>
				</div>

				<div className='flex flex-col gap-y-2'>
					<Button type='submit' isLoading={is_sign_in_pending}>
						Entrar
					</Button>
					<Button
						variant='secondary'
						type='button'
						disabled={is_sign_in_pending}
						onClick={() => navigate('/auth/sign-up')}
					>
						Cadastre-se
					</Button>
				</div>
			</div>
		</form>
	);
};

export default SignInPage;
