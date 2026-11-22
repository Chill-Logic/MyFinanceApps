import { FormEvent, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';

import { useRecoverPassword } from '@/hooks/api/auth/useRecoverPassword';
import useToast from '@/hooks/useToast';

import { AuthBackLink, AuthField, AuthHeader, AuthStatus, AuthSubmit } from '@/components/molecules/AuthForm';

/*
 * "Esqueci a senha". Depois de enviar, a tela fica e mostra pra onde foi o link (antes pulava pra redefinição, mas
 * quem chega lá é o link do e-mail, já com o código). Dá pra reenviar.
 */
const RecoverPasswordPage = () => {
	const { toast } = useToast();

	const [ email, setEmail ] = useState('');
	const [ sent_to, setSentTo ] = useState<string | null>(null);
	const { mutate: recoverPasswordMutation, isPending } = useRecoverPassword();

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();

		recoverPasswordMutation({
			body: { email },
			onSuccess: () => setSentTo(email),
			onError: (error) => {
				setSentTo(null);
				toast.error(getApiErrorMessage(error, 'Não foi possível enviar o link'));
			},
		});
	};

	return (
		<form onSubmit={onSubmit} className='flex flex-col gap-3'>
			<AuthHeader
				title='Esqueci a senha'
				subtitle='Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.'
			/>

			<AuthField
				id='email'
				type='email'
				label='E-mail'
				autoComplete='email'
				placeholder='voce@exemplo.com'
				required
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				disabled={isPending}
			/>

			<AuthSubmit isLoading={isPending} disabled={!email}>
				{sent_to ? 'Enviar de novo' : 'Enviar link'}
			</AuthSubmit>

			{sent_to && (
				<AuthStatus>
					Enviamos o link para <strong className='font-semibold'>{sent_to}</strong>. Confira a caixa de entrada e o spam.
				</AuthStatus>
			)}

			<AuthBackLink />
		</form>
	);
};

export default RecoverPasswordPage;
