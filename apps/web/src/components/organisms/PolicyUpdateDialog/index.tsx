import { Link } from 'react-router-dom';

import { getApiErrorMessage, type TPolicyKind } from '@myfinance/shared';
import { CalendarCheck, ShieldCheck } from 'lucide-react';

import { useAcceptPolicies } from '@/hooks/api/user/useAcceptPolicies';
import usePolicyVersions from '@/hooks/usePolicyVersions';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { PRIVACY_POLICY, TERMS_OF_USE } from '@/util/legalDocuments';

import Button from '@/components/atoms/Button';
import { GLASS_TILE } from '@/components/molecules/NavKit';
import SheetDialog from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';

const DOCS: Record<TPolicyKind, { doc: typeof PRIVACY_POLICY; path: string }> = {
	terms: { doc: TERMS_OF_USE, path: '/termos' },
	privacy: { doc: PRIVACY_POLICY, path: '/privacidade' },
};

/*
 * Aceite obrigatório dos documentos legais (mockup v3 "DlgPolicy", backend #26): aparece quando o `/users/me` traz
 * `pending_policies` — conta antiga que nunca aceitou ou documento que mudou de versão. Não fecha (sem ×, fora,
 * Escape ou voltar); a saída é aceitar ou sair da conta. "Ler" abre a página do documento; ao voltar, o aviso segue aqui.
 */
const PolicyUpdateDialog = () => {
	const { current_user, logout } = useCurrentUserContext();
	const versions = usePolicyVersions();
	const { toast } = useToast();
	const { mutate: accept, isPending } = useAcceptPolicies();

	const pending = (current_user.data?.pending_policies ?? []).filter((kind) => kind in DOCS);
	if (!pending.length) return null;

	const changes = pending.flatMap((kind) => DOCS[kind].doc.changes ?? []);
	const updated = changes.length > 0;
	const names = pending.map((kind) => DOCS[kind].doc.title).join(' e ');
	const title = updated ? `Atualizamos ${ pending.length > 1 ? 'os documentos' : `a ${ names }` }` : 'Antes de continuar';

	const onAccept = () => accept({
		body: { policies: pending.map((kind) => ({ kind, version: versions[kind] })) },
		onError: (error) => toast.error(getApiErrorMessage(error, 'Não foi possível registrar o aceite. Tente de novo.')),
	});

	return (
		<SheetDialog
			open
			onOpenChange={() => undefined}
			dismissible={false}
			title={title}
			context={updated ? 'Leia o que mudou e aceite para continuar' : `Publicamos os ${ names }`}
			contextIcon={CalendarCheck}
			footer={(
				<div className='flex w-full flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between'>
					<span className='text-center text-[13px] text-muted-foreground md:text-left'>
						Não concorda? <button type='button' onClick={logout} className='font-semibold underline underline-offset-[3px]'>Sair da conta</button>
					</span>
					<Button type='button' onClick={onAccept} isLoading={isPending} className='h-12 px-7 font-bold max-md:w-full'>Aceitar e continuar</Button>
				</div>
			)}
		>
			{pending.map((kind) => (
				<div key={kind} className={`flex items-center gap-3.5 rounded-[22px] p-4 ${ GLASS_TILE }`}>
					<span className='flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-brand'><ShieldCheck className='size-6' /></span>
					<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
						<span className='font-bold'>{DOCS[kind].doc.title}</span>
						<span className='text-[13px] text-muted-foreground'>Versão {versions[kind]} · <Link to={DOCS[kind].path} className='font-semibold text-brand'>Ler</Link></span>
					</span>
					<Badge variant='brand' dot>{updated ? 'Atualizada' : 'Nova'}</Badge>
				</div>
			))}
			<p className='px-1 text-sm leading-relaxed text-muted-foreground'>
				Para continuar usando o MyFinance, leia e aceite {pending.length > 1 ? 'os documentos' : 'o documento'}. Seus dados continuam como estão.
			</p>
			{updated && (
				<div className='flex flex-col gap-2 px-1'>
					<span className='text-xs font-semibold text-muted-foreground'>O que mudou</span>
					<ul className='flex flex-col gap-1.5 text-sm leading-normal'>
						{changes.map((change) => <li key={change} className='flex gap-2.5'><span className='text-brand'>•</span>{change}</li>)}
					</ul>
				</div>
			)}
		</SheetDialog>
	);
};

export default PolicyUpdateDialog;
