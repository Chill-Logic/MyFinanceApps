import { InvoiceUtils, MoneyUtils, RecurrenceUtils, type TTransaction, type TTransactionDirection } from '@myfinance/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, CircleDashed, Copy, Pencil, SearchCheck, Trash2 } from 'lucide-react';

import { useShowRecurrence } from '@/hooks/api/recurrences/useShowRecurrence';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface IProps {
	transaction: TTransaction | null;
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	/* Sentido pra esta visão (a carteira): decide o sinal do valor. */
	direction: TTransactionDirection;
	/* Origem já resolvida ("NUBANK JESCA", "X → Y", "Itaú (excluída)"). */
	sourceLabel: string;
	/* Ausente = sem a ação (ex.: transferência não é editável). */
	onEdit?: ()=> void;
	onDuplicate: ()=> void;
	onDelete: ()=> void;
	onSettle: ()=> void;
	onUnsettle: ()=> void;
	onReviewMatch?: ()=> void;
}

type TTone = 'pending' | 'late' | 'paid' | 'info' | 'neutral';

/* Selo e brilho do cabeçalho por situação (o cabeçalho é marinho nos dois temas, então as cores são fixas). */
const TONE: Record<TTone, { pill: string; dot: string; glow: string }> = {
	pending: { pill: 'bg-[rgba(233,185,73,0.16)] text-[#F2D58A]', dot: 'bg-[#E9B949]', glow: 'rgba(233,185,73,0.22)' },
	late: { pill: 'bg-[rgba(245,169,159,0.16)] text-[#F5A99F]', dot: 'bg-[#F5A99F]', glow: 'rgba(245,169,159,0.22)' },
	paid: { pill: 'bg-[rgba(125,211,160,0.16)] text-[#9FE0B6]', dot: 'bg-[#7DD3A0]', glow: 'rgba(125,211,160,0.20)' },
	info: { pill: 'bg-[rgba(7,141,167,0.20)] text-[#8FD3E2]', dot: 'bg-[#4FB8CF]', glow: 'rgba(7,141,167,0.24)' },
	neutral: { pill: 'bg-sand-light/10 text-[#E2DFDB]', dot: 'bg-[#A9B6BF]', glow: 'rgba(199,195,191,0.14)' },
};

const shortDate = (iso: string) => format(new Date(iso), 'd MMM', { locale: ptBR }).replace('.', '');
const dayTime = (iso: string) => format(new Date(iso), 'd MMM \'·\' HH:mm', { locale: ptBR }).replace('.', '');
const longDate = (iso: string) => {
	const label = format(new Date(iso), 'EEE, d MMM \'·\' HH:mm', { locale: ptBR }).replace(/\./g, '');
	return label.charAt(0).toUpperCase() + label.slice(1);
};

/*
 * Detalhe da transação (redesign 2026-11): painel flutuante à direita no tablet/desktop e tela cheia no
 * celular, como no mockup. Só MOSTRA a transação e oferece as mesmas ações do menu "⋮" da lista (quem
 * executa é a lista). Cabeçalho marinho com a situação, o valor e a descrição; abaixo, origem/responsável,
 * datas, recorrência e, no fim, a ação principal (marcar como pago ou desfazer).
 */
const TransactionDetailSheet = ({
	transaction,
	open,
	onOpenChange,
	direction,
	sourceLabel,
	onEdit,
	onDuplicate,
	onDelete,
	onSettle,
	onUnsettle,
	onReviewMatch,
}: IProps) => {
	const { data: recurrence } = useShowRecurrence(open && transaction?.recurrence_id ? transaction.recurrence_id : null);

	if (!transaction) return null;

	const is_credit = transaction.source_type === 'CreditBalance';
	const is_pending = !transaction.draft && !transaction.settled;

	/* Situação: rascunho, prevista, fatura do cartão, paga, pendente (vence em N dias) ou atrasada. */
	const status = ((): { tone: TTone; label: string } => {
		if (transaction.draft) return { tone: 'neutral', label: 'Rascunho · fora dos totais' };
		if (is_credit) {
			const invoice = transaction.invoice_month ? InvoiceUtils.monthLabel(transaction.invoice_month) : null;
			return { tone: transaction.projected ? 'info' : 'paid', label: invoice ? `Fatura de ${ invoice }` : 'Compra no cartão' };
		}
		if (transaction.settled && transaction.settled_date) return { tone: 'paid', label: `Pago · ${ shortDate(transaction.settled_date) }` };
		const days = differenceInCalendarDays(new Date(transaction.transaction_date), new Date());
		const prefix = transaction.projected ? 'Prevista' : 'Pendente';
		if (days > 1) return { tone: transaction.projected ? 'info' : 'pending', label: `${ prefix } · vence em ${ days } dias` };
		if (days === 1) return { tone: 'pending', label: `${ prefix } · vence amanhã` };
		if (days === 0) return { tone: 'pending', label: `${ prefix } · vence hoje` };
		return { tone: 'late', label: `Atrasada · venceu há ${ -days } ${ -days === 1 ? 'dia' : 'dias' }` };
	})();
	const tone = TONE[status.tone];

	/* Valor: sinal pela visão (saída −, entrada +, transferência interna sem sinal), centavos apagados. */
	const sign = { in: '+', out: '−', internal: '' }[direction];
	const formatted = MoneyUtils.formatMoney(transaction.value).replace(/^R\$\s?/, '');
	const comma = formatted.lastIndexOf(',');
	const [ value_main, value_cents ] = comma === -1 ? [ formatted, '' ] : [ formatted.slice(0, comma), formatted.slice(comma) ];

	const origin_label = (() => {
		if (transaction.kind === 'transfer') return 'De → Para';
		return is_credit ? 'Cartão' : 'Conta';
	})();
	const date_label = is_credit ? 'Compra' : 'Vencimento';
	const paid_value = (() => {
		if (is_credit) return transaction.invoice_month ? InvoiceUtils.monthLabel(transaction.invoice_month) : '—';
		return transaction.settled_date ? longDate(transaction.settled_date) : null;
	})();

	/* Recorrência/parcela: "7 de 8" com a barra de progresso quando o total é conhecido. */
	const is_installment = transaction.recurrence_type === 'installment';
	const occurrence_index = transaction.installment_number ?? transaction.recurrence_index;
	const occurrence_total = transaction.installment_total ?? recurrence?.occurrences_total ?? null;
	const recurrence_title = (() => {
		if (is_installment) return `Parcelado · ${ recurrence?.description ?? transaction.description }`;
		const rule = recurrence ? RecurrenceUtils.ruleLabel(recurrence) : null;
		return `Recorrência · ${ rule ?? recurrence?.description ?? 'mensal' }`;
	})();

	const created = transaction.created_at ? `Criada em ${ shortDate(transaction.created_at) }` : null;
	const edited = transaction.user_edited_at ? `editada em ${ shortDate(transaction.user_edited_at) }` : null;
	const footnote = [ created, edited ].filter(Boolean).join(' · ');

	const renderRecurrence = (framed: boolean) => (
		<div className={cn('flex flex-col gap-2', framed && 'rounded-[18px] border border-border px-4 py-3.5')}>
			<span className='flex justify-between gap-3 text-[13px]'>
				<span className='truncate text-muted-foreground'>{recurrence_title}</span>
				{occurrence_index && <span className='shrink-0 font-semibold'>{occurrence_total ? `${ occurrence_index } de ${ occurrence_total }` : `${ occurrence_index }ª`}</span>}
			</span>
			{occurrence_index && occurrence_total && occurrence_total <= 48 && (
				<span aria-hidden='true' className='grid gap-1' style={{ gridTemplateColumns: `repeat(${ occurrence_total }, minmax(0, 1fr))` }}>
					{Array.from({ length: occurrence_total }, (_unused, index) => (
						<span key={index} className={cn('h-1.5 rounded-full', index < occurrence_index ? 'bg-primary' : 'bg-border')} />
					))}
				</span>
			)}
		</div>
	);

	/* Linha do tempo do celular: criada → vence (ou compra) → paga (ou fatura). */
	const timeline: { label: string; value: string; state: 'done' | 'current' | 'todo' }[] = [
		...(transaction.created_at ? [ { label: 'Criada', value: shortDate(transaction.created_at), state: 'done' as const } ] : []),
		{ label: is_credit ? 'Compra' : 'Vence', value: dayTime(transaction.transaction_date), state: is_pending ? 'current' : 'done' },
		is_credit
			? { label: 'Fatura', value: paid_value ?? '—', state: 'done' }
			: { label: 'Pago', value: transaction.settled_date ? dayTime(transaction.settled_date) : '—', state: transaction.settled_date ? 'done' : 'todo' },
	];

	const ICON_BUTTON = 'pressable flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-foreground hover:bg-accent dark:bg-[rgba(199,195,191,0.04)] md:h-9 md:w-9';

	const renderFact = (label: string, value: string | null, muted = false) => (
		<div className='flex min-w-0 flex-col gap-1'>
			<dt className='text-xs text-muted-foreground'>{label}</dt>
			<dd className={cn('truncate text-sm font-semibold', (muted || value === null) && 'font-normal text-muted-foreground')}>{value ?? 'Ainda não'}</dd>
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					'flex flex-col gap-4',
					/* Celular: tela cheia */
					'max-md:inset-0 max-md:h-dvh max-md:max-h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:bg-background max-md:p-5',
					/* Tablet/desktop: painel flutuante à direita, deslizando da borda */
					'md:bottom-3 md:left-auto md:right-3 md:top-3 md:h-auto md:max-h-none md:w-[460px] md:max-w-none md:translate-x-0 md:translate-y-0 md:rounded-[28px] md:p-[22px]',
					'md:shadow-[-20px_0_60px_rgba(0,0,0,0.30)] md:data-[state=closed]:slide-out-to-right-10 md:data-[state=open]:slide-in-from-right-10 md:data-[state=closed]:zoom-out-100 md:data-[state=open]:zoom-in-100',
				)}
				closeClassName='max-md:left-5 max-md:right-auto max-md:top-5 max-md:h-10 max-md:w-10 max-md:bg-white max-md:dark:bg-[rgba(199,195,191,0.04)] md:right-[22px] md:top-[22px]'
			>
				{/* Cabeçalho: título (tablet/desktop) e ações. No celular o X fica à esquerda, as ações à direita. */}
				<header className='flex items-center justify-between gap-3 max-md:pl-12 md:pr-11'>
					<DialogTitle className='text-base font-bold max-md:sr-only'>Transação</DialogTitle>
					<DialogDescription className='sr-only'>{transaction.description}</DialogDescription>
					<div className='ml-auto flex gap-2'>
						<button type='button' aria-label='Duplicar' title='Duplicar' onClick={onDuplicate} className={ICON_BUTTON}>
							<Copy className='h-4 w-4' />
						</button>
						{onEdit && (
							<button type='button' aria-label='Editar' title='Editar' onClick={onEdit} className={ICON_BUTTON}>
								<Pencil className='h-4 w-4' />
							</button>
						)}
						<button type='button' aria-label='Excluir' title='Excluir' onClick={onDelete} className={cn(ICON_BUTTON, 'text-danger')}>
							<Trash2 className='h-4 w-4' />
						</button>
					</div>
				</header>

				<div className='no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto'>
					{/* Situação + valor + descrição, no cartão marinho (com brilho na cor da situação) */}
					<section className='relative flex flex-col items-center gap-3 overflow-hidden rounded-[22px] border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-60% px-5 py-6 text-center text-sand-light max-md:rounded-[28px] max-md:py-7'>
						<div
							aria-hidden='true'
							className='pointer-events-none absolute -top-28 left-1/2 h-60 w-72 -translate-x-1/2'
							style={{ background: `radial-gradient(50% 50% at 50% 50%, ${ tone.glow } 0%, transparent 100%)` }}
						/>
						<span className={cn('relative inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold', tone.pill)}>
							<span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
							{status.label}
						</span>
						<span className='relative text-[48px] font-semibold leading-none tracking-[-0.05em] max-md:text-[52px]'>
							{sign}{value_main}<span className='text-[#7F919C]'>{value_cents}</span>
						</span>
						<span className='relative text-[15px] text-[#E2DFDB] max-md:text-base'>{transaction.description}</span>
						{transaction.external_description && transaction.external_description !== transaction.description && (
							<span className='relative text-xs text-[#A9B6BF]'>No banco: {transaction.external_description}</span>
						)}
					</section>

					{/* Celular (como no mockup): origem/responsável, linha do tempo das datas e recorrência num cartão só */}
					<div className='flex flex-col gap-4 rounded-3xl border border-border bg-white p-[18px] dark:bg-[rgba(199,195,191,0.04)] md:hidden'>
						<dl className='grid grid-cols-2 gap-3.5'>
							{renderFact(origin_label, sourceLabel || '—')}
							{renderFact('Responsável', transaction.user_name)}
						</dl>
						<div className='h-px bg-border' />
						<ol className='flex flex-col gap-3'>
							{timeline.map((step) => (
								<li key={step.label} className='flex items-center gap-3'>
									<span
										className={cn(
											'h-2.5 w-2.5 shrink-0 rounded-full',
											step.state === 'done' && 'bg-muted-foreground/60',
											step.state === 'current' && 'bg-warning-dot shadow-[0_0_0_4px] shadow-warning-soft',
											step.state === 'todo' && 'border-2 border-border',
										)}
									/>
									<span className='flex flex-1 justify-between gap-3 text-sm'>
										<span className='text-muted-foreground'>{step.label}</span>
										<span className={cn(step.state === 'current' && 'font-semibold', step.state === 'todo' && 'text-muted-foreground')}>{step.value}</span>
									</span>
								</li>
							))}
						</ol>
						{transaction.recurrence_id && (
							<>
								<div className='h-px bg-border' />
								{renderRecurrence(false)}
							</>
						)}
					</div>

					{/* Tablet/desktop (como no mockup): fatos em grade, recorrência num quadro e "criada em" embaixo */}
					<dl className='hidden grid-cols-2 gap-x-4 gap-y-3.5 px-1 pt-1 md:grid'>
						{renderFact(origin_label, sourceLabel || '—')}
						{renderFact('Responsável', transaction.user_name)}
						{renderFact(date_label, longDate(transaction.transaction_date))}
						{renderFact(is_credit ? 'Fatura' : 'Pago em', paid_value)}
					</dl>

					{transaction.recurrence_id && <div className='hidden md:block'>{renderRecurrence(true)}</div>}

					{footnote && <span className='hidden px-1 text-xs text-muted-foreground md:block'>{footnote}</span>}
				</div>

				{/* Ações principais */}
				<div className='flex flex-col gap-2 max-md:pb-[env(safe-area-inset-bottom)]'>
					{transaction.match_review === 'pending' && onReviewMatch && (
						<Button type='button' variant='outline' size='lg' onClick={onReviewMatch} className='w-full'>
							<SearchCheck className='h-4 w-4' />
							Conferir com o banco
						</Button>
					)}
					{is_pending && (
						<Button type='button' size='lg' onClick={onSettle} className='h-[52px] w-full text-[15px] font-bold max-md:h-14 max-md:text-base'>
							<CheckCircle2 className='h-5 w-5' />
							Marcar como pago
						</Button>
					)}
					{!transaction.draft && transaction.settled && (
						<Button type='button' variant='outline' size='lg' onClick={onUnsettle} className='w-full'>
							<CircleDashed className='h-4 w-4' />
							{is_credit ? 'Desfazer efetivação' : 'Desfazer pagamento'}
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default TransactionDetailSheet;
