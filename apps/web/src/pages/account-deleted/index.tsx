import { Link, useSearchParams } from 'react-router-dom';

import { Check } from 'lucide-react';

import { longDate } from '@/util/longDate';

/*
 * Depois de excluir a conta (mockup v3 "DeleteAccountDone"). A data vem em `?ate=` (o `purge_at` da resposta): a
 * sessão já acabou, então não há de onde mais tirar.
 */
const AccountDeletedPage = () => {
	const [ search_params ] = useSearchParams();
	const purge = search_params.get('ate');

	return (
		<div className='relative flex min-h-[100dvh] flex-col items-center justify-center gap-[18px] overflow-hidden bg-background px-7 text-center text-foreground'>
			<span className='flex size-16 items-center justify-center rounded-[22px] bg-danger-soft text-destructive'><Check className='size-7' /></span>
			<h1 className='text-[26px] font-bold tracking-[-0.03em]'>Sua conta foi excluída</h1>
			<p className='max-w-[320px] text-[15px] leading-relaxed text-muted-foreground'>
				{purge
					? <>Os seus dados serão apagados de vez em <strong className='text-foreground'>{longDate(purge)}</strong>.</>
					: 'Os seus dados serão apagados de vez em até 30 dias.'}
				{' '}Até lá, este e-mail não pode ser usado numa conta nova.
			</p>
			<p className='max-w-[320px] text-[13px] leading-normal text-muted-foreground'>As carteiras compartilhadas continuam com os outros membros.</p>
			<Link to='/' className='pressable mt-2 inline-flex h-[50px] items-center rounded-full border border-border px-7 text-[15px] font-bold'>Voltar ao início</Link>
		</div>
	);
};

export default AccountDeletedPage;
