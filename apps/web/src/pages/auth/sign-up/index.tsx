import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSignUp } from '@/hooks/api/auth/useSignUp';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

type TSignUpForm = {
	name: string;
	email: string;
	password: string;
	password_confirmation: string;
};

const INITIAL_VALUES: TSignUpForm = { name: '', email: '', password: '', password_confirmation: '' };

const SignUpPage = () => {
	const navigate = useNavigate();
	const { toast } = useToast();

	const [ values, setValues ] = useState<TSignUpForm>(INITIAL_VALUES);
	const { mutate: signUpMutation, isPending: is_sign_up_pending } = useSignUp();

	const onChange = (key: keyof TSignUpForm, value: string) => {
		setValues({ ...values, [key]: value });
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (values.password !== values.password_confirmation) {
			toast.error('As senhas não coincidem');
			return;
		}

		signUpMutation({
			body: {
				name: values.name,
				email: values.email,
				password: values.password,
			},
			onSuccess: () => {
				toast.success('Cadastro realizado com sucesso!');
				navigate('/auth/sign-in');
			},
			onError: () => {
				toast.error('Verifique os campos e tente novamente');
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
						disabled={is_sign_up_pending}
					/>
					<TextInput
						type='text'
						placeholder='Insira aqui seu nome'
						label='Nome'
						name='name'
						value={values.name}
						onChange={(e) => onChange('name', e.target.value)}
						disabled={is_sign_up_pending}
					/>
					<TextInput
						type='password'
						placeholder='Insira aqui sua senha'
						label='Senha'
						name='password'
						value={values.password}
						onChange={(e) => onChange('password', e.target.value)}
						disabled={is_sign_up_pending}
					/>
					<TextInput
						type='password'
						placeholder='Confirme sua senha'
						label='Confirmar senha'
						name='password_confirmation'
						value={values.password_confirmation}
						onChange={(e) => onChange('password_confirmation', e.target.value)}
						disabled={is_sign_up_pending}
					/>
				</div>

				<div className='flex flex-col gap-y-2'>
					<Button type='submit' isLoading={is_sign_up_pending}>
						Cadastrar
					</Button>
					<Button
						variant='destructive'
						type='button'
						disabled={is_sign_up_pending}
						onClick={() => navigate(-1)}
					>
						Voltar
					</Button>
				</div>
			</div>
		</form>
	);
};

export default SignUpPage;
