import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, RECURRENCE_FREQUENCY_OPTIONS, type TRecurrence, type TRecurrenceFrequency, type TUpdateRecurrenceBody } from '@myfinance/shared';

import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import useToast from '@/hooks/useToast';

import Button from '@/components/atoms/Button';
import TextInput from '@/components/atoms/TextInput';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	recurrence: TRecurrence | null;
}

type TEnds = 'never' | 'date' | 'count';

type TFormValues = {
	description: string;
	value: string;
	value_varies: boolean;
	frequency: TRecurrenceFrequency;
	interval: string;
	ends: TEnds;
	end_date: string;
	occurrences_total: string;
};

const endsOf = (recurrence: TRecurrence): TEnds => {
	if (recurrence.occurrences_total) return 'count';
	return recurrence.end_date ? 'date' : 'never';
};

/*
 * Edita a REGRA inteira de uma recorrência (as previstas não editadas acompanham). Em compra parcelada só
 * descrição e valor da parcela — frequência e número de parcelas são da compra.
 */
const RecurrenceFormDialog = ({ open, onOpenChange, recurrence }: IProps) => {
	const { toast } = useToast();
	const { mutate: updateRecurrenceMutation, isPending } = useUpdateRecurrence();
	const [ values, setValues ] = useState<TFormValues | null>(null);

	const is_installment = recurrence?.recurrence_type === 'installment';

	useEffect(() => {
		if (!open || !recurrence) return;

		setValues({
			description: recurrence.description,
			value: MoneyUtils.formatMoney(recurrence.value),
			value_varies: recurrence.value_mode === 'estimated',
			frequency: recurrence.frequency,
			interval: String(recurrence.interval),
			ends: endsOf(recurrence),
			end_date: recurrence.end_date || '',
			occurrences_total: String(recurrence.occurrences_total || 12),
		});
	}, [ open, recurrence ]);

	if (!values || !recurrence) return null;

	const interval = Number(values.interval);
	const occurrences_total = Number(values.occurrences_total);
	const is_invalid = !values.description.trim() || !values.value
		|| (!is_installment && !(interval >= 1))
		|| (!is_installment && values.ends === 'count' && !(occurrences_total >= 1))
		|| (!is_installment && values.ends === 'date' && !values.end_date);

	const set = <K extends keyof TFormValues>(key: K, value: TFormValues[K]) => setValues((prev) => (prev ? { ...prev, [key]: value } : prev));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();

		const body: TUpdateRecurrenceBody = {
			description: values.description.trim(),
			value: Number(MoneyUtils.unformatMoney(values.value)),
			...(is_installment ? {} : {
				value_mode: values.value_varies ? 'estimated' : 'fixed',
				frequency: values.frequency,
				interval,
				end_date: values.ends === 'date' ? values.end_date : null,
				occurrences_total: values.ends === 'count' ? occurrences_total : null,
			}),
		};

		updateRecurrenceMutation({
			id: recurrence.id,
			body,
			onSuccess: () => {
				toast.success(is_installment ? 'Compra parcelada atualizada!' : 'Recorrência atualizada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar')),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{is_installment ? 'Editar compra parcelada' : 'Editar recorrência'}</DialogTitle>
					<DialogDescription>
						Vale para as ocorrências previstas que você não editou. As já confirmadas ficam como estão.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					<TextInput
						type='text'
						label='Descrição'
						name='description'
						value={values.description}
						onChange={(e) => set('description', e.target.value)}
						disabled={isPending}
					/>
					<TextInput
						type='text'
						label={is_installment ? 'Valor da parcela' : 'Valor'}
						name='value'
						value={values.value}
						onChange={(e) => set('value', MoneyUtils.formatMoney(e.target.value))}
						disabled={isPending}
					/>

					{!is_installment && (
						<>
							<label className='flex items-center gap-2 text-sm'>
								<Checkbox checked={values.value_varies} disabled={isPending} onCheckedChange={(checked) => set('value_varies', checked === true)} />
								<span>Valor varia <span className='text-muted-foreground'>— as próximas seguem o último valor real</span></span>
							</label>

							<div className='flex gap-4'>
								<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
									<label className='text-sm font-medium'>Frequência</label>
									<Select value={values.frequency} disabled={isPending} onValueChange={(next) => next && set('frequency', next as TRecurrenceFrequency)}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className='flex w-28 flex-col'>
									<TextInput
										type='number'
										label='A cada'
										name='interval'
										min={1}
										value={values.interval}
										onChange={(e) => set('interval', e.target.value)}
										disabled={isPending}
									/>
								</div>
							</div>

							<div className='flex gap-4'>
								<div className='flex min-w-0 flex-1 flex-col gap-1.5'>
									<label className='text-sm font-medium'>Termina</label>
									<Select value={values.ends} disabled={isPending} onValueChange={(next) => next && set('ends', next as TEnds)}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='never'>Nunca</SelectItem>
											<SelectItem value='date'>Numa data</SelectItem>
											<SelectItem value='count'>Após N vezes</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{values.ends === 'date' && (
									<div className='flex min-w-0 flex-1 flex-col'>
										<TextInput type='date' label='Data final' name='end_date' value={values.end_date} onChange={(e) => set('end_date', e.target.value)} disabled={isPending} />
									</div>
								)}
								{values.ends === 'count' && (
									<div className='flex min-w-0 flex-1 flex-col'>
										<TextInput type='number' label='Vezes' name='occurrences_total' min={1} value={values.occurrences_total} onChange={(e) => set('occurrences_total', e.target.value)} disabled={isPending} />
									</div>
								)}
							</div>
						</>
					)}

					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || is_invalid}>
							Salvar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default RecurrenceFormDialog;
