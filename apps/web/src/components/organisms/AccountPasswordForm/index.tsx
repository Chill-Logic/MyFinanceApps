import { FormEvent, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';
import { Eye, EyeOff } from 'lucide-react';

import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';

const INITIAL_VALUES = { current_password: '', password: '', password_confirmation: '' };

/**
 * Form de troca de senha — subitem "Atualizar senha" das Configurações. Exige a senha atual
 * (`current_password`, confirmação de identidade no backend) + nova + confirmação. Valida a
 * confirmação no client antes de bater na API (que também valida).
 */
const AccountPasswordForm = () => {
	const { toast } = useToast();
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState(INITIAL_VALUES);
	const [ show_password, setShowPassword ] = useState(false);

	const onChange = (key: keyof typeof values, value: string) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	};

	const is_submit_disabled = isPending || !values.current_password || !values.password || !values.password_confirmation;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (values.password !== values.password_confirmation) {
			toast.error('As senhas não coincidem');
			return;
		}

		updateUserMutation({
			body: values,
			onSuccess: () => {
				toast.success('Senha atualizada!');
				setValues(INITIAL_VALUES);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar senha')),
		});
	};

	return (
		<form onSubmit={handleSubmit} className='flex max-w-md flex-col gap-4'>
			<TextInput
				type={show_password ? 'text' : 'password'}
				label='Senha atual'
				name='current_password'
				placeholder='Sua senha atual'
				value={values.current_password}
				onChange={(e) => onChange('current_password', e.target.value)}
				disabled={isPending}
				rightIconComponent={show_password ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
				rightBtnAction={() => setShowPassword(!show_password)}
			/>
			<TextInput
				type={show_password ? 'text' : 'password'}
				label='Nova senha'
				name='password'
				placeholder='Nova senha'
				value={values.password}
				onChange={(e) => onChange('password', e.target.value)}
				disabled={isPending}
			/>
			<TextInput
				type={show_password ? 'text' : 'password'}
				label='Confirmar nova senha'
				name='password_confirmation'
				placeholder='Repita a nova senha'
				value={values.password_confirmation}
				onChange={(e) => onChange('password_confirmation', e.target.value)}
				disabled={isPending}
			/>
			<Button type='submit' isLoading={isPending} disabled={is_submit_disabled} className='self-start'>
				Atualizar senha
			</Button>
		</form>
	);
};

export default AccountPasswordForm;
