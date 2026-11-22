import { FormEvent, useEffect, useState } from 'react';

import {
	getApiErrorMessage,
	MoneyUtils,
	RECURRENCE_FREQUENCY_OPTIONS,
	RecurrenceUtils,
	type TRecurrence,
	type TRecurrenceFrequency,
	type TUpdateRecurrenceBody,
} from '@myfinance/shared';
import { CalendarClock, CreditCard, Landmark, Link2, Lock, Repeat, Trash2 } from 'lucide-react';

import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useUpdateRecurrence } from '@/hooks/api/recurrences/useUpdateRecurrence';
import { useListWalletMembers } from '@/hooks/api/wallets/useListWalletMembers';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';
import { dayMonth, installmentProgress, KIND_WORD } from '@/util/recurrenceView';

import Button from '@/components/atoms/Button';
import SegmentedControl from '@/components/molecules/SegmentedControl';
import { AffixInput, Field, FIELD_INPUT, Notice, SheetDialog, SheetDialogFooter, SummaryTile } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';
import Checkbox from '@/components/ui/checkbox';
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
	/* YYYY-MM-DD da próxima ocorrência (mudar = muda o dia da próxima em diante). */
	next_date: string;
	credit_card_id: string;
	user_id: string;
	/* Parcelada: total da compra (o backend divide pelas parcelas). */
	total_value: string;
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

const SELECT_TRIGGER = 'h-[52px] rounded-2xl text-[15px]';
const plainMoney = (formatted: string) => formatted.replace(/^R\$\s?/, '');

/*
 * Edita a REGRA de uma recorrência (redesign 2026-11) no casco SheetDialog.
 *   - Recorrente: descrição, valor, "valor varia", frequência, término, DATA DA PRÓXIMA (muda o dia da próxima em
 *     diante: manda `start_date` + `effective_from`, e o backend divide a regra), cartão (crédito com mais de um),
 *     responsável (carteira com mais de um membro) e "Aplicar a mudança" (todas as previstas ou da próxima em diante).
 *   - Parcelada: total da compra e número de parcelas (o backend refaz a divisão, sobra dos centavos na 1ª) e cartão.
 *     Não divide (o backend recusa `effective_from` em parcelada) e nunca menos parcelas do que as já pagas.
 * A origem não muda (a API não deixa).
 */
const RecurrenceFormDialog = ({ open, onOpenChange, recurrence, onDelete }: IProps) => {
	const { toast } = useToast();
	const { mutate: updateRecurrenceMutation, isPending } = useUpdateRecurrence();
	const [ values, setValues ] = useState<TFormValues | null>(null);

	const is_installment = recurrence?.recurrence_type === 'installment';
	const is_credit = recurrence?.source_type === 'CreditBalance';

	const { data: cards_data } = useIndexCreditCards({
		enabled: open && is_credit,
		params: { credit_balance_id: recurrence?.source_id ?? '' },
	});
	const { data: members_data } = useListWalletMembers({ enabled: open && !is_installment, wallet_id: recurrence?.wallet_id });
	const cards = cards_data?.data ?? [];
	const members = members_data ?? [];

	useEffect(() => {
		if (!open || !recurrence) return;
		const count = recurrence.occurrences_total || (recurrence.recurrence_type === 'installment' ? 1 : 12);
		setValues({
			description: recurrence.description,
			value: MoneyUtils.formatMoney(recurrence.value),
			value_varies: recurrence.value_mode === 'estimated',
			frequency: recurrence.frequency,
			interval: String(recurrence.interval),
			ends: endsOf(recurrence),
			end_date: recurrence.end_date || '',
			occurrences_total: String(count),
			scope: 'all',
			next_date: recurrence.next_occurrence?.transaction_date.split('T')[0] ?? '',
			credit_card_id: recurrence.credit_card_id ?? '',
			user_id: recurrence.user_id,
			total_value: MoneyUtils.formatMoney(recurrence.total_value ?? recurrence.value * count),
		});
	}, [ open, recurrence ]);

	if (!values || !recurrence) return null;

	const progress = is_installment ? installmentProgress(recurrence) : null;
	const interval = Number(values.interval);
	const occurrences_total = Number(values.occurrences_total);
	const value_cents = Number(MoneyUtils.unformatMoney(values.value));
	const total_cents = Number(MoneyUtils.unformatMoney(values.total_value));
	const original_next = recurrence.next_occurrence?.transaction_date.split('T')[0] ?? null;
	const date_changed = Boolean(original_next) && Boolean(values.next_date) && values.next_date !== original_next;
	/* Mudar a data da próxima vale sempre da próxima em diante (as passadas ficam nos dias delas). */
	const scope: TScope = date_changed ? 'from_next' : values.scope;
	const min_installments = Math.max(1, progress?.done ?? 1);
	const split = is_installment && occurrences_total >= 1 && total_cents > 0 ? RecurrenceUtils.splitInstallments(total_cents, occurrences_total) : null;

	const is_invalid = !values.description.trim()
		|| (!is_installment && !value_cents)
		|| (!is_installment && !(interval >= 1))
		|| (!is_installment && values.ends === 'count' && !(occurrences_total >= 1))
		|| (!is_installment && values.ends === 'date' && !values.end_date)
		|| (is_installment && (!(occurrences_total >= min_installments) || total_cents < occurrences_total));

	const set = <K extends keyof TFormValues>(key: K, value: TFormValues[K]) => setValues((prev) => (prev ? { ...prev, [key]: value } : prev));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (is_invalid || isPending) return;

		const card = is_credit && values.credit_card_id && values.credit_card_id !== recurrence.credit_card_id ? { credit_card_id: values.credit_card_id } : {};
		const body: TUpdateRecurrenceBody = is_installment
			? { description: values.description.trim(), total_value: total_cents, occurrences_total, ...card }
			: {
				description: values.description.trim(),
				value: value_cents,
				value_mode: values.value_varies ? 'estimated' : 'fixed',
				frequency: values.frequency,
				interval,
				end_date: values.ends === 'date' ? values.end_date : null,
				occurrences_total: values.ends === 'count' ? occurrences_total : null,
				...(date_changed ? { start_date: values.next_date } : {}),
				...(values.user_id !== recurrence.user_id ? { user_id: values.user_id } : {}),
				...card,
			};

		updateRecurrenceMutation({
			id: recurrence.id,
			body,
			effective_from: !is_installment && scope === 'from_next' && original_next ? original_next : undefined,
			onSuccess: () => {
				toast.success(is_installment ? 'Compra parcelada atualizada!' : 'Recorrência atualizada!');
				onOpenChange(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar')),
		});
	};

	const SourceIcon = is_credit ? CreditCard : Landmark;

	const cardField = is_credit && cards.length > 1 && (
		<Field label='Cartão'>
			<Select value={values.credit_card_id} onValueChange={(next) => next && set('credit_card_id', next)} disabled={isPending}>
				<SelectTrigger className={SELECT_TRIGGER} aria-label='Cartão'>
					<SelectValue placeholder='Escolha o cartão' />
				</SelectTrigger>
				<SelectContent>
					{cards.map((card) => (
						<SelectItem key={card.id} value={card.id}>{card.name}{card.last_digits ? ` · •••• ${ card.last_digits }` : ''}</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);

	return (
		<SheetDialog
			open={open}
			onOpenChange={onOpenChange}
			title={is_installment ? 'Editar compra parcelada' : 'Editar recorrência'}
			context={`${ KIND_WORD[recurrence.kind] } · ${ recurrence.source_name }`}
			contextIcon={is_installment ? CreditCard : Repeat}
			onSubmit={handleSubmit}
			footer={(
				<SheetDialogFooter
					submitLabel='Salvar'
					onCancel={() => onOpenChange(false)}
					isLoading={isPending}
					disabled={is_invalid}
					extra={onDelete && (
						<Button
							type='button'
							variant='ghost'
							onClick={onDelete}
							disabled={isPending}
							className='h-12 w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive max-md:border max-md:border-border md:w-auto'
						>
							<Trash2 className='size-4' />
							{is_installment ? 'Excluir compra' : 'Excluir'}
						</Button>
					)}
				/>
			)}
		>
			{/* Parcelada: a compra (cartão, progresso, total e como aparece no extrato). */}
			{progress && (
				<SummaryTile>
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
								<span key={index} className={cn('h-1.5 flex-1 rounded-full', index < progress.done ? 'bg-primary' : 'bg-foreground/15')} />
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
				</SummaryTile>
			)}

			<div className='grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'>
				<Field label='Descrição' htmlFor='recurrence-description'>
					<input
						id='recurrence-description'
						className={FIELD_INPUT}
						value={values.description}
						onChange={(event) => set('description', event.target.value)}
						disabled={isPending}
					/>
				</Field>
				{is_installment
					? (
						<Field label='Total da compra' htmlFor='recurrence-total'>
							<AffixInput
								id='recurrence-total'
								prefix='R$'
								inputMode='numeric'
								value={plainMoney(values.total_value)}
								onChange={(event) => set('total_value', MoneyUtils.formatMoney(event.target.value))}
								disabled={isPending}
							/>
						</Field>
					)
					: (
						<Field label='Valor' htmlFor='recurrence-value'>
							<AffixInput
								id='recurrence-value'
								prefix='R$'
								inputMode='numeric'
								value={plainMoney(values.value)}
								onChange={(event) => set('value', MoneyUtils.formatMoney(event.target.value))}
								disabled={isPending}
							/>
						</Field>
					)}
			</div>

			{is_installment && (
				<>
					<div className='grid gap-4 md:grid-cols-2'>
						<Field
							label='Parcelas'
							htmlFor='recurrence-installments'
							hint={progress && progress.done > 1 ? `Não dá para ter menos que ${ progress.done }: já estão pagas.` : undefined}
						>
							<AffixInput
								id='recurrence-installments'
								type='number'
								min={min_installments}
								suffix='x'
								value={values.occurrences_total}
								onChange={(event) => set('occurrences_total', event.target.value)}
								disabled={isPending}
							/>
						</Field>
						{cardField}
					</div>
					{split && (
						<p className='px-1 text-xs text-muted-foreground'>
							{occurrences_total}x de {MoneyUtils.formatMoney(split.installment)}
							{split.first !== split.installment && ` (1ª de ${ MoneyUtils.formatMoney(split.first) })`}
							{' '}— a divisão é refeita nas parcelas previstas; as já pagas ficam como estão.
						</p>
					)}
				</>
			)}

			{!is_installment && (
				<>
					<label className='flex items-start gap-3 px-1 text-sm'>
						<Checkbox className='mt-0.5' checked={values.value_varies} disabled={isPending} onCheckedChange={(checked) => set('value_varies', checked === true)} />
						<span><strong className='font-semibold'>Valor varia</strong> <span className='text-muted-foreground'>— as próximas seguem o último valor real</span></span>
					</label>

					<div className='grid grid-cols-2 gap-3'>
						<Field label='Repete'>
							<Select value={values.frequency} disabled={isPending} onValueChange={(next) => next && set('frequency', next as TRecurrenceFrequency)}>
								<SelectTrigger className={SELECT_TRIGGER} aria-label='Frequência'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field label='A cada' htmlFor='recurrence-interval'>
							<AffixInput
								id='recurrence-interval'
								type='number'
								min={1}
								suffix={UNIT[values.frequency][interval === 1 ? 0 : 1]}
								className='pr-20'
								value={values.interval}
								onChange={(event) => set('interval', event.target.value)}
								disabled={isPending}
							/>
						</Field>
					</div>

					{original_next && (
						<Field
							label='Data da próxima'
							htmlFor='recurrence-next'
							hint={date_changed
								? `Muda o dia de ${ dayMonth(values.next_date) } em diante; as de antes ficam nos dias delas.`
								: 'Mude para trocar o dia (ex.: o salário passou a cair no dia 10).'}
						>
							<input
								id='recurrence-next'
								type='date'
								className={FIELD_INPUT}
								value={values.next_date}
								onChange={(event) => set('next_date', event.target.value)}
								disabled={isPending}
							/>
						</Field>
					)}

					<Field label='Termina'>
						<SegmentedControl segments={ENDS_SEGMENTS} value={values.ends} onChange={(next) => set('ends', next as TEnds)} />
						{values.ends === 'date' && (
							<input
								type='date'
								aria-label='Data final'
								className={FIELD_INPUT}
								value={values.end_date}
								onChange={(event) => set('end_date', event.target.value)}
								disabled={isPending}
							/>
						)}
						{values.ends === 'count' && (
							<AffixInput
								type='number'
								min={1}
								aria-label='Quantas vezes'
								suffix='vezes'
								className='pr-16'
								value={values.occurrences_total}
								onChange={(event) => set('occurrences_total', event.target.value)}
								disabled={isPending}
							/>
						)}
					</Field>

					{(cardField || members.length > 1) && (
						<div className='grid gap-4 md:grid-cols-2'>
							{cardField}
							{members.length > 1 && (
								<Field label='Responsável'>
									<Select value={values.user_id} onValueChange={(next) => next && set('user_id', next)} disabled={isPending}>
										<SelectTrigger className={SELECT_TRIGGER} aria-label='Responsável'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
										</SelectContent>
									</Select>
								</Field>
							)}
						</div>
					)}

					{original_next && (
						<Field label='Aplicar a mudança'>
							<SegmentedControl
								segments={[
									{ value: 'all', label: 'Todas as previstas', disabled: date_changed, title: date_changed ? 'Mudar a data vale da próxima em diante' : undefined },
									{ value: 'from_next', label: `De ${ dayMonth(original_next) } em diante` },
								]}
								value={scope}
								onChange={(next) => set('scope', next as TScope)}
							/>
							<span className='px-1 text-xs text-muted-foreground'>
								{scope === 'from_next'
									? `As de antes de ${ dayMonth(original_next) } continuam com a regra antiga. As já lançadas e as que você editou à mão ficam como estão.`
									: 'Vale para todas as previstas que você não editou. As já lançadas ficam como estão.'}
							</span>
						</Field>
					)}
				</>
			)}

			<Notice icon={Lock}>A origem não muda depois de criada. Para trocar a conta ou o crédito, exclua e crie de novo.</Notice>
			{/* O backend só divide quando a próxima não é a primeira ocorrência (effective_from > start_date). */}
			{!is_installment && date_changed && original_next! > recurrence.start_date && (
				<Notice tone='info' icon={CalendarClock}>A regra é dividida: a antiga termina na véspera de {dayMonth(original_next!)} e a nova começa em {dayMonth(values.next_date)}.</Notice>
			)}
		</SheetDialog>
	);
};

export default RecurrenceFormDialog;
