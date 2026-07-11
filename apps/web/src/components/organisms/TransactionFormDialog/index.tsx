import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, type TTransaction, type TTransactionKind } from '@myfinance/shared';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { useCreateTransactions } from '@/hooks/api/transactions/useCreateTransactions';
import { useUpdateTransactions } from '@/hooks/api/transactions/useUpdateTransactions';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	transaction?: TTransaction | null;
	suggestedDate?: Date;
}

type TFormValues = {
	kind: TTransactionKind;
	description: string;
	value: string;
	transaction_date: Date;
};

const buildDefaultValues = (suggestedDate?: Date): TFormValues => ({
	kind: 'deposit',
	description: '',
	value: '',
	transaction_date: suggestedDate ?? new Date(),
});

const TransactionFormDialog = ({ open, onOpenChange, transaction, suggestedDate }: IProps) => {
	const { user_wallet } = useWallet();
	const { toast } = useToast();

	const { mutate: createTransactionMutation, isPending: is_create_pending } = useCreateTransactions();
	const { mutate: updateTransactionMutation, isPending: is_update_pending } = useUpdateTransactions();

	const [ values, setValues ] = useState<TFormValues>(buildDefaultValues(suggestedDate));

	useEffect(() => {
		if (!open) return;

		if (transaction) {
			setValues({
				kind: transaction.kind,
				description: transaction.description,
				value: MoneyUtils.formatMoney(transaction.value),
				transaction_date: new Date(transaction.transaction_date),
			});
		} else {
			setValues(buildDefaultValues(suggestedDate));
		}
	}, [ open, transaction, suggestedDate ]);

	const is_pending = is_create_pending || is_update_pending;
	const is_submit_disabled = is_pending || !values.value || !values.description;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		const value = Number(MoneyUtils.unformatMoney(values.value));
		const body = {
			kind: values.kind,
			description: values.description,
			value,
			transaction_date: values.transaction_date.toISOString(),
		};

		if (transaction) {
			updateTransactionMutation({
				body,
				id: transaction.id,
				onSuccess: () => {
					toast.success('Transação atualizada!');
					onOpenChange(false);
				},
				onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar transação')),
			});
			return;
		}

		if (!user_wallet.data) {
			toast.error('Selecione uma carteira para continuar');
			return;
		}

		createTransactionMutation({
			body: { ...body, wallet_id: user_wallet.data.id },
			onSuccess: () => {
				toast.success('Transação criada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao criar transação')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{transaction ? `Editar ${ transaction.kind === 'deposit' ? 'entrada' : 'saída' }` : 'Nova transação'}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<div className='flex flex-col gap-1.5'>
						<label className='text-sm font-medium'>Tipo</label>
						<Select value={values.kind} onValueChange={(value) => setValues({ ...values, kind: value as TTransactionKind })}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='deposit'>Entrada</SelectItem>
								<SelectItem value='withdraw'>Saída</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<TextInput
						type='text'
						label='Descrição'
						name='description'
						placeholder='Digite a descrição'
						value={values.description}
						onChange={(e) => setValues({ ...values, description: e.target.value })}
						disabled={is_pending}
					/>

					<div className='flex flex-col gap-4 sm:flex-row'>
						<TextInput
							type='text'
							label='Valor'
							name='value'
							placeholder='R$ 0,00'
							value={values.value}
							onChange={(e) => setValues({ ...values, value: MoneyUtils.formatMoney(e.target.value) })}
							disabled={is_pending}
							className='flex-1'
						/>

						<div className='flex flex-1 flex-col gap-1.5'>
							<label className='text-sm font-medium'>Data</label>
							<Popover>
								<PopoverTrigger asChild>
									<Button type='button' variant='outline' disabled={is_pending} className='justify-start gap-2 font-normal'>
										<CalendarIcon className='h-4 w-4' />
										{format(values.transaction_date, 'dd/MM/yyyy')}
									</Button>
								</PopoverTrigger>
								<PopoverContent className='w-auto p-0' align='start'>
									<Calendar
										mode='single'
										selected={values.transaction_date}
										onSelect={(date) => date && setValues({ ...values, transaction_date: date })}
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={is_pending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={is_pending} disabled={is_submit_disabled}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default TransactionFormDialog;
