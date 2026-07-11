import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';

import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

/**
 * Form de dados pessoais (nome/e-mail) — subitem "Informações pessoais" das Configurações. Só
 * perfil; a troca de senha vive num form separado (AccountPasswordForm). Atualiza o current_user no
 * contexto no sucesso pra a UI refletir na hora.
 */
const AccountInfoForm = () => {
	const { toast } = useToast();
	const { current_user, setCurrentUser } = useCurrentUserContext();
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState({ name: '', email: '' });

	useEffect(() => {
		if (current_user.data) {
			setValues({ name: current_user.data.name, email: current_user.data.email });
		}
	}, [ current_user.data ]);

	const onChange = (key: keyof typeof values, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const is_unchanged = current_user.data?.name === values.name && current_user.data?.email === values.email;
	const is_submit_disabled = isPending || is_unchanged || !values.name || !values.email;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		updateUserMutation({
			body: { name: values.name, email: values.email },
			onSuccess: (user) => {
				setCurrentUser({ data: user });
				toast.success('Dados atualizados!');
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar dados')),
		});
	};

	return (
		<form onSubmit={handleSubmit} className='flex max-w-md flex-col gap-4'>
			<TextInput
				type='text'
				label='Nome'
				name='name'
				placeholder='Seu nome'
				value={values.name}
				onChange={(e) => onChange('name', e.target.value)}
				disabled={isPending}
			/>
			<TextInput
				type='email'
				label='E-mail'
				name='email'
				placeholder='seu@email.com'
				value={values.email}
				onChange={(e) => onChange('email', e.target.value)}
				disabled={isPending}
			/>
			<Button type='submit' isLoading={isPending} disabled={is_submit_disabled} className='self-start'>
				Salvar
			</Button>
		</form>
	);
};

export default AccountInfoForm;
