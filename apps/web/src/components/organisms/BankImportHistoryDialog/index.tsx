import { useState } from 'react';

import { BankConnectionUtils, DateUtils, getApiErrorMessage, type TBankAccountLink, type TBankImport } from '@myfinance/shared';
import { History, Undo2 } from 'lucide-react';

import { useIndexBankImports } from '@/hooks/api/bank-imports/useIndexBankImports';
import { useUndoBankImport } from '@/hooks/api/bank-imports/useUndoBankImport';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

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

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	link: TBankAccountLink | null;
}

const TONE_CLASS = {
	success: 'text-feedback-success-default',
	warning: 'text-feedback-warning-default',
	error: 'text-destructive',
	neutral: 'text-muted-foreground',
} as const;

const BankImportHistoryDialog = ({ open, onOpenChange, link }: IProps) => {
	const { toast } = useToast();
	const { data, isLoading } = useIndexBankImports({
		enabled: open && Boolean(link),
		params: { bank_account_link_id: link?.id || '' },
	});
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
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className='max-h-[85vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>Histórico {link?.name ? `· ${ link.name }` : ''}</DialogTitle>
						<DialogDescription>Importações manuais e automáticas desta conta, da mais recente para a mais antiga.</DialogDescription>
					</DialogHeader>

					{isLoading && (
						<div className='flex flex-col gap-2'>
							{Array.from({ length: 3 }).map((_, index) => (
								<Skeleton key={index} className='h-20 w-full' />
							))}
						</div>
					)}

					{!isLoading && imports.length === 0 && (
						<div className='flex flex-col items-center gap-2 py-8 text-center'>
							<History className='h-10 w-10 text-muted-foreground' />
							<span className='font-medium'>Nenhuma importação ainda</span>
						</div>
					)}

					{!isLoading && imports.length > 0 && (
						<ul className='flex flex-col gap-2'>
							{imports.map((bank_import) => {
								const status = BankConnectionUtils.importStatus(bank_import.status);

								return (
									<li key={bank_import.id} className='flex flex-col gap-2 rounded-lg border border-border p-3'>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0'>
												<p className='text-sm font-medium text-foreground'>
													{DateUtils.formateTo(bank_import.created_at, 'dd/MM/yyyy \'às\' HH:mm')}
												</p>
												<p className='text-xs text-muted-foreground'>
													{BankConnectionUtils.importPeriodLabel(bank_import)}
													{' · '}
													{BankConnectionUtils.importModeLabel(bank_import.mode)}
													{' · '}
													{BankConnectionUtils.importTriggerLabel(bank_import.trigger)}
												</p>
											</div>
											<span className={cn('shrink-0 text-xs font-semibold', TONE_CLASS[status.tone])}>{status.label}</span>
										</div>

										<p className='text-xs text-muted-foreground'>
											{bank_import.status === 'failed'
												? bank_import.error_message || 'A importação falhou.'
												: BankConnectionUtils.importSummaryMessage([ bank_import ])}
										</p>

										{bank_import.status === 'completed' && (
											<div className='flex flex-col items-end gap-1'>
												<Button
													type='button'
													size='sm'
													variant='secondary'
													onClick={() => setUndoingImport(bank_import)}
													disabled={!bank_import.undoable}
													className='gap-2'
												>
													<Undo2 className='h-4 w-4' />
													Desfazer
												</Button>
												{!bank_import.undoable && bank_import.undo_blocker && (
													<span className='text-right text-xs text-muted-foreground'>{bank_import.undo_blocker}</span>
												)}
											</div>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</DialogContent>
			</Dialog>

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

export default BankImportHistoryDialog;
