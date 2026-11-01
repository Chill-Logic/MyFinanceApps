import { FormEvent, useEffect, useState } from 'react';

import {
	BANK_IMPORT_MODE_OPTIONS,
	BANK_IMPORT_RETENTION_HELP,
	BankConnectionUtils,
	getApiErrorMessage,
	type TBankAccountLink,
	type TBankImportMode,
} from '@myfinance/shared';
import { AlertTriangle } from 'lucide-react';

import { useCreateBankImport } from '@/hooks/api/bank-imports/useCreateBankImport';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Label from '@/components/ui/label';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	link: TBankAccountLink | null;
}

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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-h-[90vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Importar período {link?.name ? `· ${ link.name }` : ''}</DialogTitle>
					<DialogDescription>{BANK_IMPORT_RETENTION_HELP}</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
						<TextInput type='date' label='De' value={date_from} max={date_to || undefined} onChange={(event) => setDateFrom(event.target.value)} />
						<TextInput type='date' label='Até' value={date_to} min={date_from || undefined} onChange={(event) => setDateTo(event.target.value)} />
					</div>

					<div className='flex flex-col gap-2' role='radiogroup' aria-label='Modo de importação'>
						<span className='text-sm font-medium text-foreground'>Modo</span>
						{BANK_IMPORT_MODE_OPTIONS.map((option) => {
							const active = option.value === mode;

							return (
								<button
									key={option.value}
									type='button'
									role='radio'
									aria-checked={active}
									onClick={() => setMode(option.value)}
									className={cn(
										'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
										active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
										option.warning && active && 'border-feedback-warning-default bg-feedback-warning-light/40',
									)}
								>
									<span className={cn('flex items-center gap-1.5 font-medium text-foreground', option.warning && 'text-feedback-warning-dark dark:text-feedback-warning-default')}>
										{option.warning && <AlertTriangle className='h-4 w-4' />}
										{option.label}
									</span>
									<span className='text-xs text-muted-foreground'>{option.description}</span>
								</button>
							);
						})}
					</div>

					{is_bank && (
						<div className='flex items-center gap-2'>
							<Checkbox id='adjust_balance' checked={adjust_balance} onCheckedChange={(checked) => setAdjustBalance(checked === true)} />
							<Label htmlFor='adjust_balance' className='text-sm'>Ajustar o saldo para bater com o banco</Label>
						</div>
					)}

					<DialogFooter className='gap-2'>
						<Button type='button' variant='secondary' onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
						<Button type='submit' isLoading={isPending} disabled={!is_period_valid}>Importar</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default BankImportDialog;
