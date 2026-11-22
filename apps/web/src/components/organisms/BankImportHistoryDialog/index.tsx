import { useState } from 'react';

import { BankConnectionUtils, DateUtils, getApiErrorMessage, type TBankAccountLink, type TBankImport } from '@myfinance/shared';
import { History, Undo2 } from 'lucide-react';

import { useIndexBankImports } from '@/hooks/api/bank-imports/useIndexBankImports';
import { useUndoBankImport } from '@/hooks/api/bank-imports/useUndoBankImport';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';
import { STATUS_TEXT } from '@/util/bankView';

import Button from '@/components/atoms/Button';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const TONE = { success: 'success', warning: 'warning', error: 'error', neutral: 'neutral' } as const;

/* "Automática · atualizar" / "Manual · não sobrescrever · 02/11/2025 a 02/11/2026". */
const detailLine = (bank_import: TBankImport) => {
	const parts = [ BankConnectionUtils.importTriggerLabel(bank_import.trigger), BankConnectionUtils.importModeLabel(bank_import.mode).toLowerCase() ];
	if (bank_import.trigger === 'manual') parts.push(BankConnectionUtils.importPeriodLabel(bank_import));
	return parts.join(' · ');
};

const resultLine = (bank_import: TBankImport) => {
	if (bank_import.status === 'failed') return bank_import.error_message || 'A importação falhou.';
	if (bank_import.status === 'undone' && bank_import.undone_at) {
		return `Desfeita em ${ DateUtils.formateTo(bank_import.undone_at, 'dd/MM \'às\' HH:mm') }`;
	}
	return BankConnectionUtils.shortImportSummary(bank_import);
};

/*
 * Histórico de importações de uma conta/cartão do banco (redesign 2026-11): mais recente primeiro, com status,
 * tipo (manual/automática), modo, período e resultado. "Desfazer" fica desabilitado com o motivo quando a API
 * bloqueia (`undo_blocker`). Usado no painel lateral de "Contas do banco" e dentro do diálogo/folha abaixo.
 */
export const BankImportHistoryList = ({ link, enabled = true, compact = false }: { link: TBankAccountLink; enabled?: boolean; compact?: boolean }) => {
	const { toast } = useToast();
	const { data, isLoading } = useIndexBankImports({ enabled, params: { bank_account_link_id: link.id } });
	const { mutate: undoMutation, isPending: is_undo_pending } = useUndoBankImport();
	const [ undoing_import, setUndoingImport ] = useState<TBankImport | null>(null);

	const imports = data?.data || [];

	const handleConfirmUndo = () => {
		if (!undoing_import) return;

		undoMutation({
			id: undoing_import.id,
			onSuccess: () => {
				toast.success('Importação desfeita');
				setUndoingImport(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Não foi possível desfazer a importação'));
				setUndoingImport(null);
			},
		});
	};

	return (
		<>
			{isLoading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className='h-20 w-full rounded-2xl' />)}
				</div>
			)}

			{!isLoading && imports.length === 0 && (
				<div className='flex flex-col items-center gap-2 py-8 text-center'>
					<History className='size-8 text-muted-foreground' />
					<span className='font-semibold'>Nenhuma importação ainda</span>
					<span className='text-sm text-muted-foreground'>Importe um período ou ligue a sincronização automática.</span>
				</div>
			)}

			{!isLoading && imports.length > 0 && (
				<ul className='flex flex-col divide-y divide-border'>
					{imports.map((bank_import) => {
						const status = BankConnectionUtils.importStatus(bank_import.status);
						return (
							<li key={bank_import.id} className={cn('flex gap-3 py-3.5', compact ? 'flex-col' : 'items-start')}>
								<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
									<span className='flex flex-wrap items-baseline gap-x-2'>
										<span className='font-bold'>{BankConnectionUtils.whenLabel(bank_import.created_at)}</span>
										<span className={cn('text-xs font-semibold', STATUS_TEXT[TONE[status.tone]])}>{status.label}</span>
									</span>
									<span className='text-xs text-muted-foreground'>{detailLine(bank_import)}</span>
									<span className='text-sm'>{resultLine(bank_import)}</span>
								</div>
								{bank_import.status === 'completed' && (
									<div className={cn('flex shrink-0 gap-1', compact ? 'flex-row items-center gap-3' : 'max-w-[150px] flex-col items-end')}>
										<Button
											type='button'
											variant='outline'
											onClick={() => setUndoingImport(bank_import)}
											disabled={!bank_import.undoable}
											className='h-9 gap-1.5 px-3.5'
										>
											<Undo2 className='size-4' />
											Desfazer
										</Button>
										{!bank_import.undoable && bank_import.undo_blocker && (
											<span className={cn('text-[11px] leading-tight text-muted-foreground', !compact && 'text-right')}>{bank_import.undo_blocker}</span>
										)}
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}

			<AlertDialog open={Boolean(undoing_import)} onOpenChange={(next) => !next && setUndoingImport(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Desfazer importação</AlertDialogTitle>
						<AlertDialogDescription>
							As transações criadas por esta importação serão removidas, as que ela alterou voltam ao que eram e as que ela removeu voltam.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_undo_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmUndo} disabled={is_undo_pending}>Desfazer</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

/* Nome + "•••• 4821" (quando há número). */
export const linkTitle = (link: TBankAccountLink) => [ link.name, link.external_type === 'CREDIT' ? BankConnectionUtils.maskedNumber(link.number) : link.number ].filter(Boolean).join(' · ');

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	link: TBankAccountLink | null;
}

/* Histórico em diálogo (tablet) ou folha presa embaixo (celular). No desktop ele fica no painel ao lado. */
const BankImportHistoryDialog = ({ open, onOpenChange, link }: IProps) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent
			/* Sem foco automático: o primeiro botão é "Desfazer", e um Enter sem querer abriria a confirmação. */
			onOpenAutoFocus={(event) => event.preventDefault()}
			className={cn(
				'max-h-[85dvh] md:max-w-[560px]',
				'max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(1.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]',
				'max-md:data-[state=open]:slide-in-from-bottom-8 max-md:data-[state=open]:zoom-in-100'
			)}
		>
			<span aria-hidden='true' className='mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-border md:hidden' />
			<DialogHeader className='pr-10 text-left'>
				<DialogTitle className='text-xl font-bold tracking-[-0.02em]'>Histórico de importações</DialogTitle>
				{link && <span className='text-sm text-muted-foreground'>{linkTitle(link)}</span>}
				<DialogDescription>Desfazer apaga o que a importação criou, volta o que ela mudou e traz de volta o que ela removeu.</DialogDescription>
			</DialogHeader>
			{link && <BankImportHistoryList link={link} enabled={open} />}
		</DialogContent>
	</Dialog>
);

export default BankImportHistoryDialog;
