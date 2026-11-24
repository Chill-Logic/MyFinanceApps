import { FormEvent, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';
import { Eye, EyeOff } from 'lucide-react';

import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { passwordProblem } from '@/components/molecules/AuthForm';
import { SETTINGS_CARD, SETTINGS_FIELD, SETTINGS_LABEL } from '@/components/organisms/AccountInfoForm';

const INITIAL_VALUES = { current_password: '', password: '', password_confirmation: '' };

/**
 * Troca de senha das Configurações, num cartão (redesign 2026-11). Exige a senha atual (o backend confere) e valida
 * no cliente o tamanho (6 a 128) e a confirmação, com as mensagens em português.
 */
const AccountPasswordForm = ({ className }: { className?: string }) => {
	const { toast } = useToast();
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState(INITIAL_VALUES);
	const [ shown, setShown ] = useState(false);

	const onChange = (key: keyof typeof values, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
	const is_submit_disabled = isPending || !values.current_password || !values.password || !values.password_confirmation;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const problem = passwordProblem(values.password, values.password_confirmation);
		if (problem) {
			toast.error(problem);
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

	const field = (key: keyof typeof values, label: string, autoComplete: string, hint?: string) => (
		<div className='flex flex-col gap-2'>
			<label htmlFor={`settings-${ key }`} className={SETTINGS_LABEL}>{label}</label>
			<div className='relative'>
				<input
					id={`settings-${ key }`}
					type={shown ? 'text' : 'password'}
					className={cn(SETTINGS_FIELD, key === 'current_password' && 'pr-12')}
					autoComplete={autoComplete}
					maxLength={128}
					value={values[key]}
					onChange={(e) => onChange(key, e.target.value)}
					disabled={isPending}
				/>
				{key === 'current_password' && (
					<button
						type='button'
						onClick={() => setShown(!shown)}
						aria-label={shown ? 'Esconder senhas' : 'Mostrar senhas'}
						className='pressable absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground'
					>
						{shown ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
					</button>
				)}
			</div>
			{hint && <span className='px-1 text-xs text-muted-foreground'>{hint}</span>}
		</div>
	);

	return (
		<form onSubmit={handleSubmit} className={cn(SETTINGS_CARD, className)}>
			<div className='flex flex-col gap-0.5'>
				<h3 className='text-lg font-bold'>Senha</h3>
				<p className='text-sm text-muted-foreground'>Para trocar, confirme a atual.</p>
			</div>
			{field('current_password', 'Senha atual', 'current-password')}
			{field('password', 'Nova senha', 'new-password', 'Mínimo de 6 caracteres.')}
			{field('password_confirmation', 'Confirmar nova senha', 'new-password')}
			<Button type='submit' isLoading={isPending} disabled={is_submit_disabled} className='mt-auto h-12 self-start px-6 font-bold max-md:w-full'>
				Atualizar senha
			</Button>
		</form>
	);
};

export default AccountPasswordForm;
