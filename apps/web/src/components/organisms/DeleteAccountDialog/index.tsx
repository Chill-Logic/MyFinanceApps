import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@myfinance/shared';
import { LogOut, Plug, Trash2, TriangleAlert, Users, type LucideIcon } from 'lucide-react';

import { useDeleteCurrentUser } from '@/hooks/api/user/useDeleteCurrentUser';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { cn } from '@/lib/utils';
import { daysFromToday, longDate } from '@/util/longDate';
import { forgetGoogleAccount } from '@/util/rememberedGoogleAccount';

import { GLASS_TILE } from '@/components/molecules/NavKit';
import SheetDialog, { Field, FIELD_INPUT, Notice, SheetDialogFooter } from '@/components/molecules/SheetDialog';

/* O que acontece com cada tipo de carteira (regra do backend #25). */
const WALLET_CASES: { icon: LucideIcon; tone: string; title: string; text: string }[] = [
	{ icon: Users, tone: 'bg-info-soft text-info', title: 'Você administra', text: 'Continua com os outros membros. A administração passa para quem mais lançou nos últimos 90 dias.' },
	{ icon: Trash2, tone: 'bg-danger-soft text-destructive', title: 'Só tem você', text: 'É apagada, com contas, cartões e transações.' },
	{ icon: LogOut, tone: 'bg-secondary text-muted-foreground', title: 'Você participa', text: 'Você sai. O que você lançou continua lá, como “Usuário removido”.' },
];

const CONFIRMATION = 'EXCLUIR';

/*
 * Excluir a própria conta (mockup v3 "DlgDeleteAccount", backend #25 `DELETE /users/me`). Confirma com a senha; conta
 * sem senha (só Google, `has_password === false` — backend #29) confirma digitando EXCLUIR. Depois: esquece a conta do
 * Google lembrada, sai e mostra "Sua conta foi excluída" com a data em que os dados somem (`purge_at`).
 */
const DeleteAccountDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean)=> void }) => {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { current_user, logout } = useCurrentUserContext();
	const { mutate: deleteAccount, isPending } = useDeleteCurrentUser();
	const [ value, setValue ] = useState('');

	const with_password = current_user.data?.has_password !== false;
	const ready = with_password ? value.length > 0 : value.trim().toUpperCase() === CONFIRMATION;

	const close = (next: boolean) => {
		if (isPending) return;
		if (!next) setValue('');
		onOpenChange(next);
	};

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!ready) return;
		deleteAccount({
			body: with_password ? { password: value } : { confirmation: CONFIRMATION },
			onSuccess: ({ data }) => {
				forgetGoogleAccount();
				navigate(`/conta-excluida?ate=${ data.purge_at.slice(0, 10) }`, { replace: true });
				logout();
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível excluir a conta. Tente de novo.')),
		});
	};

	return (
		<SheetDialog
			open={open}
			onOpenChange={close}
			title='Excluir sua conta'
			description='Leia antes de confirmar.'
			onSubmit={onSubmit}
			footer={<SheetDialogFooter destructive submitLabel={<><Trash2 className='size-4' />Excluir minha conta</>} onCancel={() => close(false)} isLoading={isPending} disabled={!ready} />}
		>
			<Notice tone='danger' icon={TriangleAlert}>
				<span className='text-foreground'>
					Sua conta será bloqueada imediatamente e todos os seus dados serão apagados em <strong>{longDate(daysFromToday(30))}</strong>. Esta ação não pode ser desfeita.
				</span>
			</Notice>
			<div className='flex flex-col gap-2'>
				<span className='px-1 text-xs font-semibold text-muted-foreground'>O que acontece com as carteiras que:</span>
				<div className={cn('flex flex-col divide-y divide-border rounded-[20px]', GLASS_TILE)}>
					{WALLET_CASES.map(({ icon: Icon, tone, title, text }) => (
						<div key={title} className='flex gap-3 px-3.5 py-3'>
							<span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-[11px]', tone)}><Icon className='size-4' /></span>
							<span className='flex min-w-0 flex-col gap-0.5'>
								<span className='text-[14.5px] font-semibold'>{title}</span>
								<span className='text-[13px] leading-snug text-muted-foreground'>{text}</span>
							</span>
						</div>
					))}
				</div>
			</div>
			<span className='flex gap-2 px-1 text-[13px] text-muted-foreground'><Plug className='mt-0.5 size-[15px] shrink-0' />As conexões MCP serão desligadas.</span>
			<Field
				htmlFor='delete-confirmation'
				label={with_password ? 'Digite a sua senha para confirmar' : <>Você entra com o Google. Digite <strong>{CONFIRMATION}</strong> para confirmar</>}
			>
				<input
					id='delete-confirmation'
					type={with_password ? 'password' : 'text'}
					autoComplete={with_password ? 'current-password' : 'off'}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					disabled={isPending}
					className={cn(FIELD_INPUT, !with_password && 'uppercase tracking-[0.04em]')}
				/>
			</Field>
		</SheetDialog>
	);
};

export default DeleteAccountDialog;
