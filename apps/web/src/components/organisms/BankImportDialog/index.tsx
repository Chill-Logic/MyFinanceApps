import { FormEvent, useEffect, useState } from 'react';

import {
	BANK_IMPORT_MODE_OPTIONS,
	BANK_IMPORT_RETENTION_HELP,
	BankConnectionUtils,
	DateUtils,
	getApiErrorMessage,
	type TBankAccountLink,
	type TBankImportMode,
} from '@myfinance/shared';
import { AlertTriangle, Download, Link2 } from 'lucide-react';

import { useCreateBankImport } from '@/hooks/api/bank-imports/useCreateBankImport';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import { Field, FIELD_INPUT, FIELD_LABEL, Notice, RadioCard, SheetDialog, SheetDialogFooter } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';
import Checkbox from '@/components/ui/checkbox';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	link: TBankAccountLink | null;
}

/* O rótulo do shared traz "(recomendado)" no texto; aqui ele vira selo. */
const RECOMMENDED_SUFFIX = /\s*\(recomendado\)\s*$/i;

/* Importar período (redesign 2026-11, mockup "DlgBankImport"): período, modo em cartões e ajuste de saldo. */
const BankImportDialog = ({ open, onOpenChange, link }: IProps) => {
	const { toast } = useToast();
	const { mutate: createImportMutation, isPending } = useCreateBankImport();

	const [ date_from, setDateFrom ] = useState('');
	const [ date_to, setDateTo ] = useState('');
	const [ mode, setMode ] = useState<TBankImportMode>('preserve');
	const [ adjust_balance, setAdjustBalance ] = useState(false);

	useEffect(() => {
		if (!open) return;

		const period = BankConnectionUtils.defaultImportPeriod();
		setDateFrom(period.date_from);
		setDateTo(period.date_to);
		setMode('preserve');
		setAdjustBalance(false);
	}, [ open ]);

	const is_bank = link?.external_type === 'BANK';
	const is_period_valid = Boolean(date_from) && Boolean(date_to) && date_from <= date_to;
	const is_overwrite = BANK_IMPORT_MODE_OPTIONS.some((option) => option.value === mode && option.warning);

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!link || !is_period_valid) return;

		createImportMutation({
			body: {
				bank_account_link_id: link.id,
				mode,
				date_from,
				date_to,
				adjust_balance: is_bank && adjust_balance,
			},
			onSuccess: (bank_import) => {
				toast.success(`Importação concluída: ${ BankConnectionUtils.importSummaryMessage([ bank_import ]) }`);
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao importar o período')),
		});
	};

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title='Importar período'
			context={link?.name}
			contextIcon={Link2}
			description={BANK_IMPORT_RETENTION_HELP}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel={(
						<>
							<Download className='size-4' />
							Importar
						</>
					)}
					onCancel={() => onOpenChange(false)}
					isLoading={isPending}
					disabled={!is_period_valid}
				/>
			)}
		>
			<div className='grid grid-cols-2 gap-3'>
				<Field label='De' htmlFor='bank-import-from'>
					<input
						id='bank-import-from'
						type='date'
						className={cn(FIELD_INPUT, 'min-w-0')}
						value={date_from}
						max={date_to || undefined}
						onChange={(event) => setDateFrom(event.target.value)}
						disabled={isPending}
					/>
				</Field>
				<Field label='Até' htmlFor='bank-import-to'>
					<input
						id='bank-import-to'
						type='date'
						className={cn(FIELD_INPUT, 'min-w-0')}
						value={date_to}
						min={date_from || undefined}
						onChange={(event) => setDateTo(event.target.value)}
						disabled={isPending}
					/>
				</Field>
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='Modo de importação'>
				<span className={FIELD_LABEL}>Modo</span>
				{BANK_IMPORT_MODE_OPTIONS.map((option) => {
					const is_recommended = RECOMMENDED_SUFFIX.test(option.label);

					return (
						<RadioCard
							key={option.value}
							checked={option.value === mode}
							onSelect={() => setMode(option.value)}
							warning={option.warning}
							disabled={isPending}
							title={(
								<span className={cn('inline-flex items-center gap-1.5', option.warning && option.value === mode && 'text-warning')}>
									{option.warning && <AlertTriangle className='size-3.5 shrink-0' />}
									{option.label.replace(RECOMMENDED_SUFFIX, '')}
								</span>
							)}
							badge={is_recommended ? <Badge variant='brand'>recomendado</Badge> : undefined}
							description={option.description}
						/>
					);
				})}
			</div>

			{is_overwrite && is_period_valid && (
				<Notice tone='warning' icon={AlertTriangle}>
					Tudo o que você editou ou excluiu à mão entre {DateUtils.formatDate(date_from)} e {DateUtils.formatDate(date_to)} volta a ser como está no banco.
				</Notice>
			)}

			{is_bank && (
				<label htmlFor='adjust_balance' className='flex cursor-pointer items-start gap-2.5 px-1 text-sm'>
					<Checkbox
						id='adjust_balance'
						className='mt-0.5'
						checked={adjust_balance}
						onCheckedChange={(checked) => setAdjustBalance(checked === true)}
						disabled={isPending}
					/>
					<span className='flex flex-col gap-0.5'>
						<span className='font-medium'>Ajustar o saldo para bater com o banco</span>
						<span className='text-xs text-muted-foreground'>Depois de importar, o saldo da conta fica igual ao que o banco informa.</span>
					</span>
				</label>
			)}
		</SheetDialog>
	);
};

export default BankImportDialog;
