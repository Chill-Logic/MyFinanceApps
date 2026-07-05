import { useNavigate } from 'react-router-dom';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

const SignInPage = () => {
	const navigate = useNavigate();

	return (
		<form 
			onSubmit={(e) => {
				e.preventDefault();
				alert('Login realizado com sucesso!');
			}}
		>
			<div className='flex flex-col gap-y-8'>
				<div className='w-full flex flex-col gap-y-4'>
					<TextInput type='email' placeholder='Insira aqui seu e-mail' label='E-mail' />
					<TextInput type='password' placeholder='Insira aqui sua senha' label='Senha' />
				</div>
				<div className='flex flex-col gap-y-2'>
					<Button
						type='submit'
					>
						Entrar
					</Button>
					<Button
						theme='secondary'
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
