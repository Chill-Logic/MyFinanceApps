import { FormEvent, useEffect, useState } from 'react';

import { getApiErrorMessage, MoneyUtils, RECURRENCE_FREQUENCY_OPTIONS, type TRecurrence, type TRecurrenceFrequency, type TUpdateRecurrenceBody } from '@myfinance/shared';
import { CreditCard, Landmark, Link2, Lock, Trash2, TriangleAlert } from 'lucide-react';

import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';
import { dayMonth, installmentProgress, KIND_WORD } from '@/util/recurrenceView';

import Button from '@/components/atoms/Button';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import Badge from '@/components/ui/badge';
import Checkbox from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FIELD_SURFACE } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	recurrence: TRecurrence | null;
	/* "Excluir" no rodapé: quem abre decide (confirmação fica na lista). */
	onDelete?: ()=> void;
}

type TEnds = 'never' | 'date' | 'count';
type TScope = 'all' | 'from_next';

type TFormValues = {
	description: string;
	value: string;
	value_varies: boolean;
	frequency: TRecurrenceFrequency;
	interval: string;
	ends: TEnds;
	end_date: string;
	occurrences_total: string;
	scope: TScope;
};

const endsOf = (recurrence: TRecurrence): TEnds => {
	if (recurrence.occurrences_total) return 'count';
	return recurrence.end_date ? 'date' : 'never';
};

const UNIT: Record<TRecurrenceFrequency, [string, string]> = {
	weekly: [ 'semana', 'semanas' ],
	monthly: [ 'mês', 'meses' ],
	yearly: [ 'ano', 'anos' ],
};

const ENDS_SEGMENTS = [
	{ value: 'never', label: 'Nunca' },
	{ value: 'date', label: 'Numa data' },
	{ value: 'count', label: 'Após N vezes' },
];

const LABEL = 'px-1 text-[13px] text-muted-foreground';
const FIELD = cn(FIELD_SURFACE, 'h-12 w-full text-[15px]');

/*
 * Edita a REGRA de uma recorrência (redesign 2026-11, mockup v3): folha que sobe de baixo no celular, diálogo do
 * tablet em diante. Recorrente: descrição, valor, "valor varia", frequência, término e "Aplicar a mudança" (todas as
 * previstas, ou da próxima em diante = `effective_from`, que divide a regra no backend). Parcelada: só descrição e
 * valor da parcela, com o progresso da compra em cima — número de parcelas, cartão e 1º mês são da compra. A origem
 * não muda (a API não deixa).
 */
const RecurrenceFormDialog = ({ open, onOpenChange, recurrence, onDelete }: IProps) => {
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
			scope: 'all',
		});
	}, [ open, recurrence ]);

	if (!values || !recurrence) return null;

	const interval = Number(values.interval);
	const occurrences_total = Number(values.occurrences_total);
	const value_cents = Number(MoneyUtils.unformatMoney(values.value));
	const is_invalid = !values.description.trim() || !value_cents
		|| (!is_installment && !(interval >= 1))
		|| (!is_installment && values.ends === 'count' && !(occurrences_total >= 1))
		|| (!is_installment && values.ends === 'date' && !values.end_date);

	const next_date = recurrence.next_occurrence?.transaction_date.split('T')[0] ?? null;
	const progress = is_installment ? installmentProgress(recurrence) : null;
	const value_changed = value_cents !== recurrence.value;

	const set = <K extends keyof TFormValues>(key: K, value: TFormValues[K]) => setValues((prev) => (prev ? { ...prev, [key]: value } : prev));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();

		const body: TUpdateRecurrenceBody = {
			description: values.description.trim(),
			value: value_cents,
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
			effective_from: !is_installment && values.scope === 'from_next' && next_date ? next_date : undefined,
			onSuccess: () => {
				toast.success(is_installment ? 'Compra parcelada atualizada!' : 'Recorrência atualizada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar')),
		});
	};

	const SourceIcon = recurrence.source_type === 'CreditBalance' ? CreditCard : Landmark;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					'md:max-w-[560px]',
					/* Celular: folha presa embaixo, com a alcinha. */
					'max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[28px] max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(1.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]',
					'max-md:data-[state=open]:slide-in-from-bottom-8 max-md:data-[state=open]:zoom-in-100'
				)}
			>
				<span aria-hidden='true' className='mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-border md:hidden' />
				<DialogHeader className='pr-10 text-left'>
					<DialogTitle className='text-xl font-bold tracking-[-0.02em]'>{is_installment ? 'Editar compra parcelada' : 'Editar recorrência'}</DialogTitle>
					{is_installment
						? (
							<DialogDescription>
								Vale para as parcelas previstas que você não editou. As já confirmadas ficam como estão.
							</DialogDescription>
						)
						: (
							<DialogDescription className='flex items-center gap-1.5'>
								<Lock className='size-3.5 shrink-0' />
								{KIND_WORD[recurrence.kind]} · {recurrence.source_name} · não dá para trocar a origem
							</DialogDescription>
						)}
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					{/* Parcelada: a compra (cartão, progresso, total e como aparece no extrato). */}
					{progress && (
						<div className='flex flex-col gap-2.5 rounded-2xl border border-border bg-secondary/50 p-4'>
							<div className='flex items-center justify-between gap-2'>
								<span className='flex min-w-0 items-center gap-2 text-sm font-semibold'>
									<SourceIcon className='size-4 shrink-0' />
									<span className='truncate'>{recurrence.source_name}</span>
								</span>
								{recurrence.origin === 'bank' && <Badge variant='brand'><Link2 className='size-3' />do banco</Badge>}
							</div>
							{progress.total_count <= 24 && (
								<div className='flex gap-1' aria-hidden='true'>
									{Array.from({ length: progress.total_count }).map((_, index) => (
										<span key={index} className={cn('h-1.5 flex-1 rounded-full', index < progress.done ? 'bg-primary' : 'bg-border')} />
									))}
								</div>
							)}
							<div className='flex flex-wrap items-baseline justify-between gap-x-3 text-xs'>
								<span>
									<strong className='font-bold'>{progress.done} de {progress.total_count} pagas</strong>
									<span className='text-muted-foreground'> · faltam {MoneyUtils.formatMoney(progress.remaining)}</span>
								</span>
								<span className='text-muted-foreground'>total {MoneyUtils.formatMoney(progress.total_value)}</span>
							</div>
							{recurrence.external_description && (
								<span className='text-xs text-muted-foreground'>
									No extrato do banco: <span className='font-mono font-semibold text-foreground/80'>{recurrence.external_description}</span>
								</span>
							)}
						</div>
					)}

					<div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
						<div className='flex min-w-0 flex-col gap-2'>
							<label htmlFor='recurrence-description' className={LABEL}>Descrição</label>
							<input
								id='recurrence-description'
								className={FIELD}
								value={values.description}
								onChange={(event) => set('description', event.target.value)}
								disabled={isPending}
							/>
						</div>
						<div className='flex min-w-0 flex-col gap-2'>
							<label htmlFor='recurrence-value' className={LABEL}>{is_installment ? 'Valor da parcela' : 'Valor'}</label>
							<div className='relative'>
								<span className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>R$</span>
								<input
									id='recurrence-value'
									inputMode='numeric'
									className={cn(FIELD, 'pl-11')}
									value={values.value.replace(/^R\$\s?/, '')}
									onChange={(event) => set('value', MoneyUtils.formatMoney(event.target.value))}
									disabled={isPending}
								/>
							</div>
						</div>
					</div>

					{is_installment && value_changed && recurrence.total_value && (
						<p className='flex items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning'>
							<TriangleAlert className='mt-0.5 size-4 shrink-0' />
							Mudar o valor da parcela apaga o total da compra: o que falta passa a ser calculado só pela parcela nova.
						</p>
					)}
					{is_installment && (
						<p className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
							<Lock className='size-3.5 shrink-0' />
							Número de parcelas, cartão e mês da 1ª são da compra e não mudam aqui.
						</p>
					)}

					{!is_installment && (
						<>
							<label className='flex items-start gap-3 px-1 text-sm'>
								<Checkbox className='mt-0.5' checked={values.value_varies} disabled={isPending} onCheckedChange={(checked) => set('value_varies', checked === true)} />
								<span><strong className='font-semibold'>Valor varia</strong> <span className='text-muted-foreground'>— as próximas seguem o último valor real</span></span>
							</label>

							<div className='grid grid-cols-2 gap-3'>
								<div className='flex min-w-0 flex-col gap-2'>
									<span className={LABEL}>Repete</span>
									<Select value={values.frequency} disabled={isPending} onValueChange={(next) => next && set('frequency', next as TRecurrenceFrequency)}>
										<SelectTrigger className='h-12 text-[15px]' aria-label='Frequência'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className='flex min-w-0 flex-col gap-2'>
									<label htmlFor='recurrence-interval' className={LABEL}>A cada</label>
									<div className='relative'>
										<input
											id='recurrence-interval'
											type='number'
											min={1}
											className={cn(FIELD, 'pr-20')}
											value={values.interval}
											onChange={(event) => set('interval', event.target.value)}
											disabled={isPending}
										/>
										<span className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
											{UNIT[values.frequency][interval === 1 ? 0 : 1]}
										</span>
									</div>
								</div>
							</div>

							<div className='flex flex-col gap-2'>
								<span className={LABEL}>Termina</span>
								<SegmentedControl segments={ENDS_SEGMENTS} value={values.ends} onChange={(next) => set('ends', next as TEnds)} />
								{values.ends === 'date' && (
									<input
										type='date'
										aria-label='Data final'
										className={FIELD}
										value={values.end_date}
										onChange={(event) => set('end_date', event.target.value)}
										disabled={isPending}
									/>
								)}
								{values.ends === 'count' && (
									<div className='relative'>
										<input
											type='number'
											min={1}
											aria-label='Quantas vezes'
											className={cn(FIELD, 'pr-16')}
											value={values.occurrences_total}
											onChange={(event) => set('occurrences_total', event.target.value)}
											disabled={isPending}
										/>
										<span className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>vezes</span>
									</div>
								)}
							</div>

							{next_date && (
								<div className='flex flex-col gap-2'>
									<span className={LABEL}>Aplicar a mudança</span>
									<SegmentedControl
										segments={[
											{ value: 'all', label: 'Todas as previstas' },
											{ value: 'from_next', label: `De ${ dayMonth(next_date) } em diante` },
										]}
										value={values.scope}
										onChange={(next) => set('scope', next as TScope)}
									/>
									<p className='px-1 text-xs text-muted-foreground'>
										{values.scope === 'from_next'
											? `As de antes de ${ dayMonth(next_date) } continuam com a regra antiga. As já lançadas e as que você editou à mão ficam como estão.`
											: 'Vale para todas as previstas que você não editou. As já lançadas ficam como estão.'}
									</p>
								</div>
							)}
						</>
					)}

					<div className='mt-1 flex items-center gap-2'>
						{onDelete && (
							<Button
								type='button'
								variant='ghost'
								onClick={onDelete}
								disabled={isPending}
								className='h-12 text-destructive hover:bg-destructive/10 hover:text-destructive max-md:border max-md:border-border max-md:px-5'
							>
								<Trash2 className='size-4' />
								{is_installment ? 'Excluir compra' : 'Excluir'}
							</Button>
						)}
						<Button type='button' variant='ghost' onClick={() => onOpenChange(false)} disabled={isPending} className='ml-auto h-12 max-md:hidden'>
							Cancelar
						</Button>
						<Button type='submit' isLoading={isPending} disabled={isPending || is_invalid} className='h-12 px-7 font-bold max-md:ml-auto max-md:flex-1'>
							Salvar
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default RecurrenceFormDialog;
