import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage } from '@myfinance/shared';

import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { FIELD_SURFACE } from '@/components/ui/field';

export const SETTINGS_CARD = 'flex flex-col gap-4 rounded-3xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none md:p-6';
export const SETTINGS_LABEL = 'px-1 text-[13px] text-muted-foreground';
export const SETTINGS_FIELD = cn(FIELD_SURFACE, 'h-12 w-full text-[15px]');

/**
 * "Informações pessoais" (nome e e-mail) das Configurações, num cartão (redesign 2026-11). O e-mail também é o
 * login — a API troca sem confirmação. Atualiza o current_user no contexto no sucesso.
 */
const AccountInfoForm = ({ className }: { className?: string }) => {
	const { toast } = useToast();
	const { current_user, setCurrentUser } = useCurrentUserContext();
	const { mutate: updateUserMutation, isPending } = useUpdateCurrentUser();

	const [ values, setValues ] = useState({ name: '', email: '' });

	useEffect(() => {
		if (current_user.data) setValues({ name: current_user.data.name, email: current_user.data.email });
	}, [ current_user.data ]);

	const onChange = (key: keyof typeof values, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

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
		<form onSubmit={handleSubmit} className={cn(SETTINGS_CARD, className)}>
			<div className='flex flex-col gap-0.5'>
				<h3 className='text-lg font-bold'>Informações pessoais</h3>
				<p className='text-sm text-muted-foreground'>Seu e-mail também é o login.</p>
			</div>
			<div className='flex flex-col gap-2'>
				<label htmlFor='settings-name' className={SETTINGS_LABEL}>Nome</label>
				<input id='settings-name' className={SETTINGS_FIELD} autoComplete='name' value={values.name} onChange={(e) => onChange('name', e.target.value)} disabled={isPending} />
			</div>
			<div className='flex flex-col gap-2'>
				<label htmlFor='settings-email' className={SETTINGS_LABEL}>E-mail</label>
				<input id='settings-email' type='email' className={SETTINGS_FIELD} autoComplete='email' value={values.email} onChange={(e) => onChange('email', e.target.value)} disabled={isPending} />
			</div>
			<Button type='submit' isLoading={isPending} disabled={is_submit_disabled} className='mt-auto h-12 self-start px-6 font-bold max-md:w-full'>
				Salvar alterações
			</Button>
		</form>
	);
};

export default AccountInfoForm;
