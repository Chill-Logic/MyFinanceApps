import { useEffect, useRef, useState } from 'react';

import { getApiErrorMessage, InvoiceUtils, MONTH_NAMES_PT, MoneyUtils, type TCreditBalance, type TCreditCard, type TCurrentInvoice } from '@myfinance/shared';
import { format } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, CreditCard as CreditCardIcon, Link2, MoreVertical, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';

import icon_mark from '@/assets/brand/icon.svg';

import { useDeleteCreditBalance } from '@/hooks/api/credit-balances/useDeleteCreditBalance';
import { useGetInvoice } from '@/hooks/api/credit-balances/useGetInvoice';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { useDeleteCreditCard } from '@/hooks/api/credit-cards/useDeleteCreditCard';
import { useIndexCreditCards } from '@/hooks/api/credit-cards/useIndexCreditCards';
import { useListTransactions } from '@/hooks/api/transactions/useListTransactions';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { groupTransactionsByDay } from '@/util/groupTransactionsByDay';

import Button from '@/components/atoms/Button';
import CreditBalanceFormDialog from '@/components/organisms/CreditBalanceFormDialog';
import CreditCardFormDialog from '@/components/organisms/CreditCardFormDialog';
import InvoiceReviewDialog from '@/components/organisms/InvoiceReviewDialog';
import MatchReviewDialog from '@/components/organisms/MatchReviewDialog';
import NewCardDialog from '@/components/organisms/NewCardDialog';
import PayInvoiceDialog from '@/components/organisms/PayInvoiceDialog';
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
import Badge from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

/* Superfície dos cartões claros/translúcidos do mockup (branco no claro, véu areia no escuro). */
const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
/* Degradê azul-petróleo do logo: o "cartão físico" selecionado. */
const CARD_GRADIENT = 'bg-[radial-gradient(120%_120%_at_0%_0%,#12708A_0%,#0B3E52_48%,#082435_100%)]';

/* Só string (sem `Date`) pra datas de calendário do backend não deslocarem por fuso: "2026-12-10" → "10/12". */
const dayMonth = (iso: string): string => {
	const [ , month, day ] = iso.split('T')[0].split('-');
	return day && month ? `${ day }/${ month }` : iso;
};
/* "2026-12-10" → "10 dez" */
const dayMonthName = (iso: string): string => {
	const [ , month, day ] = iso.split('T')[0].split('-');
	const name = MONTH_NAMES_PT[Number(month) - 1];
	return day && name ? `${ Number(day) } ${ name.slice(0, 3).toLowerCase() }` : iso;
};
/* Dia seguinte ao fim do ciclo = quando o ciclo vira (o melhor dia de compra). */
const nextDay = (iso: string): string => {
	const [ year, month, day ] = iso.split('T')[0].split('-').map(Number);
	const date = new Date(year, month - 1, day + 1);
	return `${ date.getFullYear() }-${ String(date.getMonth() + 1).padStart(2, '0') }-${ String(date.getDate()).padStart(2, '0') }`;
};

/* Situação da fatura em palavras: paga, quanto falta, ou quando vence. */
const invoiceStatus = (invoice: TCurrentInvoice | undefined) => {
	if (!invoice) return '';
	if (invoice.amount <= 0) return 'sem compras';
	if (invoice.paid) return 'paga';
	if ((invoice.paid_amount ?? 0) > 0) return `restante ${ MoneyUtils.formatMoney(invoice.remaining) }`;
	return `vence ${ dayMonth(invoice.due_date) }`;
};

interface IBigCardProps {
	creditBalance: TCreditBalance;
	lastDigits?: string | null;
	className?: string;
	/* Tablet/desktop: setas ‹ › ao lado do nome pra trocar de cartão (no celular quem troca é o carrossel). */
	onPrev?: ()=> void;
	onNext?: ()=> void;
	/* Sentido da última troca: o conteúdo do cartão entra deslizando por esse lado. */
	direction?: 'next' | 'prev';
}

/* Cartão "físico" (como no mockup): nome, chip, fatura atual, final do cartão e vencimento. */
const BigCard = ({ creditBalance, lastDigits, className, onPrev, onNext, direction }: IBigCardProps) => {
	const invoice = creditBalance.current_invoice;
	/*
	 * Troca pelas setas/pontinhos: nome e fatura entram deslizando do lado da troca (próximo → da direita,
	 * anterior → da esquerda). O `key` por cartão remonta só esses trechos, então as setas não animam.
	 */
	const slide = direction
		? cn('animate-in fade-in-0 duration-300 ease-out', direction === 'prev' ? 'slide-in-from-left-6' : 'slide-in-from-right-6')
		: undefined;
	const ARROW = 'pressable flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sand-light hover:bg-white/20';
	return (
		<div
			className={cn(
				'relative flex aspect-[318/192] w-full flex-col justify-between overflow-hidden rounded-3xl border border-white/15 p-5 text-left text-sand-light',
				CARD_GRADIENT,
				className,
			)}
		>
			<img src={icon_mark} alt='' aria-hidden='true' className='pointer-events-none absolute -bottom-14 -right-12 h-44 w-44 opacity-[0.14]' />
			<span className='relative flex w-full items-center justify-between gap-3'>
				<span className='flex min-w-0 items-center gap-1.5 text-[15px] font-semibold'>
					{onPrev && (
						<button type='button' onClick={onPrev} aria-label='Cartão anterior' className={ARROW}>
							<ChevronLeft className='h-4 w-4' />
						</button>
					)}
					<span key={creditBalance.id} className={cn('truncate', slide)}>{creditBalance.name}</span>
					{creditBalance.bank_linked && <Link2 className='h-3.5 w-3.5 shrink-0 opacity-70' aria-label='Sincronizado com o banco' />}
					{onNext && (
						<button type='button' onClick={onNext} aria-label='Próximo cartão' className={ARROW}>
							<ChevronRight className='h-4 w-4' />
						</button>
					)}
				</span>
				<span aria-hidden='true' className='h-6 w-[34px] shrink-0 rounded-md bg-gradient-to-br from-[#E2DFDB] to-[#A8A39D]' />
			</span>
			<span key={`${ creditBalance.id }-invoice`} className={cn('relative flex w-full flex-col gap-1', slide)}>
				<span className='text-xs text-[#A9B6BF]'>Fatura de {InvoiceUtils.label(invoice).toLowerCase()}</span>
				<span className='text-[30px] font-semibold leading-none tracking-[-0.04em]'>{MoneyUtils.formatMoney(invoice.amount)}</span>
				<span className='mt-1 flex justify-between font-mono text-xs text-[#A9B6BF]'>
					<span>{lastDigits ? `•••• ${ lastDigits }` : ''}</span>
					<span>{invoice.paid && invoice.amount > 0 ? 'paga' : `vence ${ dayMonth(invoice.due_date) }`}</span>
				</span>
			</span>
		</div>
	);
};

interface IDetailProps {
	creditBalance: TCreditBalance;
	walletId: string;
}

/*
 * Detalhe do cartão selecionado: navegação de faturas, pagar, total/limite/ciclo, plásticos e as compras
 * da fatura exibida. Mesmo comportamento do cartão de crédito de antes do redesign (só o layout mudou),
 * mais a lista de compras, que é só leitura.
 */
const CreditBalanceDetail = ({ creditBalance, walletId }: IDetailProps) => {
	const { toast } = useToast();

	const { data: cards_data, isLoading: is_cards_loading } = useIndexCreditCards({ params: { credit_balance_id: creditBalance.id } });
	const { mutate: deleteBalanceMutation, isPending: is_delete_balance_pending } = useDeleteCreditBalance();
	const { mutate: deleteCardMutation, isPending: is_delete_card_pending } = useDeleteCreditCard();

	const [ is_edit_open, setIsEditOpen ] = useState(false);
	const [ is_delete_open, setIsDeleteOpen ] = useState(false);
	const [ is_pay_open, setIsPayOpen ] = useState(false);
	const [ is_review_open, setIsReviewOpen ] = useState(false);
	const [ is_match_review_open, setIsMatchReviewOpen ] = useState(false);
	const [ editing_card, setEditingCard ] = useState<TCreditCard | null>(null);
	const [ deleting_card, setDeletingCard ] = useState<TCreditCard | null>(null);
	/* 0 = ciclo atual (usa a fatura embutida no index, sem request); ±N navega ciclos vizinhos. */
	const [ cycle_offset, setCycleOffset ] = useState(0);

	const is_current_cycle = cycle_offset === 0;
	/* Mês da fatura exibida — sempre calculado, pra o pagamento mirar a fatura da tela (não a de hoje). */
	const invoice_month = InvoiceUtils.shiftMonth(creditBalance.current_invoice.invoice_month, cycle_offset);
	const { data: navigated_invoice, isFetching: is_invoice_fetching } = useGetInvoice({
		id: creditBalance.id,
		enabled: !is_current_cycle,
		params: { reference: invoice_month },
	});

	const { data: transactions_data, isLoading: is_transactions_loading } = useListTransactions({
		params: { wallet_id: walletId, reference: invoice_month, source_type: 'CreditBalance', source_id: creditBalance.id },
	});

	const cards = cards_data?.data || [];
	const invoice = is_current_cycle ? creditBalance.current_invoice : navigated_invoice;
	const is_invoice_loading = !is_current_cycle && is_invoice_fetching && !invoice;
	const is_current = Boolean(invoice) && InvoiceUtils.isCurrent(invoice!);
	const cycle_label = invoice ? InvoiceUtils.label(invoice) : InvoiceUtils.monthLabel(invoice_month);
	const limit = creditBalance.credit_limit || 0;
	const used_pct = limit > 0 ? Math.min(100, Math.max(0, (creditBalance.used / limit) * 100)) : 0;
	const remaining = invoice?.remaining ?? 0;
	const is_partial = Boolean(invoice) && (invoice!.paid_amount ?? 0) > 0 && !invoice!.paid;
	const can_pay = remaining > 0;
	const purchases = (transactions_data?.credits.data || []).filter((item) => item.source_id === creditBalance.id);

	/* Dias abertos em "Nesta fatura" (fora do Set = recolhido, que é o padrão — como na Home). */
	const [ open_days, setOpenDays ] = useState<Set<string>>(new Set());
	const toggleDay = (label: string) => setOpenDays((current) => {
		const next = new Set(current);
		if (next.has(label)) next.delete(label);
		else next.add(label);
		return next;
	});

	const status_label = (() => {
		if (!invoice) return '';
		if (invoice.paid && invoice.amount > 0) return 'paga';
		const state = is_partial ? `restante ${ MoneyUtils.formatMoney(remaining) }` : 'aberta';
		return is_current ? `${ state } · fatura atual` : state;
	})();

	const pay_label = (() => {
		if (invoice?.paid) return 'Fatura paga';
		if (is_partial) return 'Pagar restante';
		return 'Pagar fatura';
	})();

	const handleDeleteBalance = () => {
		deleteBalanceMutation({
			id: creditBalance.id,
			onSuccess: () => {
				toast.success('Crédito removido com sucesso');
				setIsDeleteOpen(false);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover crédito'));
				setIsDeleteOpen(false);
			},
		});
	};

	const handleDeleteCard = () => {
		if (!deleting_card) return;

		deleteCardMutation({
			id: deleting_card.id,
			onSuccess: () => {
				toast.success('Cartão removido com sucesso');
				setDeletingCard(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao remover cartão'));
				setDeletingCard(null);
			},
		});
	};

	const renderStat = (label: string, value: React.ReactNode, hint?: React.ReactNode, className?: string) => (
		<div className={cn('flex min-w-0 flex-col gap-1 rounded-[20px] border border-border p-3.5', className)}>
			<span className='text-xs text-muted-foreground'>{label}</span>
			<span className='truncate text-[17px] font-semibold tracking-[-0.02em]'>{value}</span>
			{hint && <span className='truncate text-xs text-muted-foreground'>{hint}</span>}
		</div>
	);

	return (
		<section className={cn('flex min-w-0 flex-col gap-4 rounded-3xl p-4 md:p-5', SURFACE)}>
			{/* Fatura exibida (‹ ›) + pagar + ações do crédito */}
			<div className='flex flex-wrap items-center justify-between gap-3'>
				{/* No celular a navegação ocupa a linha toda: setas nas pontas, fatura centralizada entre elas. */}
				<div className='flex items-center gap-2 max-sm:w-full max-sm:justify-between'>
					<Button type='button' variant='outline' size='icon' className='h-9 w-9 shrink-0' onClick={() => setCycleOffset((offset) => offset - 1)} aria-label='Fatura anterior'>
						<ChevronLeft className='h-4 w-4' />
					</Button>
					<div className='flex min-w-[9.5rem] flex-col items-center text-center max-sm:flex-1'>
						<span className='text-[15px] font-semibold'>Fatura de {cycle_label.toLowerCase()}</span>
						<span className={cn('text-xs', invoice?.paid ? 'text-success' : 'text-muted-foreground')}>{status_label || ' '}</span>
					</div>
					<Button type='button' variant='outline' size='icon' className='h-9 w-9 shrink-0' onClick={() => setCycleOffset((offset) => offset + 1)} aria-label='Próxima fatura'>
						<ChevronRight className='h-4 w-4' />
					</Button>
				</div>

				<div className='flex items-center gap-2 max-sm:w-full'>
					<Button type='button' onClick={() => setIsPayOpen(true)} disabled={!can_pay} className='max-sm:flex-1'>
						{pay_label}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type='button' variant='outline' size='icon' aria-label='Ações do crédito'>
								<MoreVertical className='h-4 w-4' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={() => setIsEditOpen(true)}>
								<Pencil className='mr-2 h-4 w-4' />
								Editar crédito
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className='text-destructive focus:text-destructive'>
								<Trash2 className='mr-2 h-4 w-4' />
								Excluir crédito
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{(creditBalance.pending_invoice_reviews_count > 0 || creditBalance.pending_match_reviews_count > 0) && (
				<div className='flex flex-wrap gap-2'>
					{creditBalance.pending_invoice_reviews_count > 0 && (
						<button type='button' onClick={() => setIsReviewOpen(true)} className='rounded-full transition-opacity hover:opacity-80'>
							<Badge variant='warning'>
								<AlertTriangle className='h-3 w-3' />
								{creditBalance.pending_invoice_reviews_count} {creditBalance.pending_invoice_reviews_count === 1 ? 'pendência' : 'pendências'} de fatura
							</Badge>
						</button>
					)}
					{creditBalance.pending_match_reviews_count > 0 && (
						<button type='button' onClick={() => setIsMatchReviewOpen(true)} className='rounded-full transition-opacity hover:opacity-80'>
							<Badge variant='info'>{creditBalance.pending_match_reviews_count} para conferir</Badge>
						</button>
					)}
				</div>
			)}

			{/* Total da fatura · limite disponível · ciclo */}
			<div className='grid grid-cols-2 gap-2.5 md:grid-cols-3'>
				{renderStat(
					'Total da fatura',
					is_invoice_loading ? <Skeleton className='h-6 w-24' /> : MoneyUtils.formatMoney(invoice?.amount ?? 0),
					invoice && invoice.paid_amount > 0 ? `pago ${ MoneyUtils.formatMoney(invoice.paid_amount) }` : invoiceStatus(invoice),
				)}
				<div className='flex min-w-0 flex-col gap-1.5 rounded-[20px] border border-border p-3.5'>
					<span className='text-xs text-muted-foreground'>Limite disponível</span>
					<span className='truncate text-[17px] font-semibold tracking-[-0.02em]'>{MoneyUtils.formatMoney(creditBalance.available)}</span>
					<span aria-label={`${ Math.round(used_pct) }% do limite usado`} className='flex h-1.5 overflow-hidden rounded-full bg-border'>
						<span className='rounded-full bg-primary' style={{ width: `${ used_pct }%` }} />
					</span>
					<span className='truncate text-xs text-muted-foreground'>de {MoneyUtils.formatMoney(limit)}</span>
				</div>
				{invoice && renderStat(
					'Ciclo vira · vence',
					`${ dayMonthName(nextDay(invoice.cycle_end)) } · ${ dayMonthName(invoice.due_date) }`,
					`${ dayMonth(invoice.cycle_start) } – ${ dayMonth(invoice.cycle_end) }`,
					/* No celular (2 colunas) ocupa a linha inteira pra não ficar sozinho pela metade. */
					'col-span-2 md:col-span-1',
				)}
			</div>

			{/* Plásticos deste crédito */}
			<div className='flex flex-col gap-2'>
				<span className='text-xs font-semibold text-muted-foreground'>Cartões deste crédito</span>
				{!is_cards_loading && cards.length === 0 && (
					<div className='flex items-start gap-2 rounded-2xl bg-warning-soft px-3 py-2 text-xs text-warning'>
						<AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
						<span>Cadastre um cartão para lançar compras neste crédito — sem cartão, ele não aparece como origem nas transações.</span>
					</div>
				)}
				{is_cards_loading ? <Skeleton className='h-9 w-40 rounded-full' /> : (
					<div className='flex flex-wrap gap-2'>
						{cards.map((card) => (
							<span key={card.id} className='inline-flex h-9 items-center gap-1.5 rounded-full border border-border pl-3 pr-1 text-sm'>
								<CreditCardIcon className='h-3.5 w-3.5 text-muted-foreground' />
								{card.name}
								{card.last_digits && <span className='font-mono text-xs text-muted-foreground'>•••• {card.last_digits}</span>}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button type='button' aria-label={`Ações do cartão ${ card.name }`} className='pressable flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent'>
											<MoreVertical className='h-3.5 w-3.5' />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={() => setEditingCard(card)}>
											<Pencil className='mr-2 h-4 w-4' />
											Editar
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setDeletingCard(card)} className='text-destructive focus:text-destructive'>
											<Trash2 className='mr-2 h-4 w-4' />
											Excluir
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</span>
						))}
					</div>
				)}
			</div>

			{/* Compras da fatura exibida (só leitura) */}
			<div className='flex flex-col'>
				<div className='flex justify-between pb-1.5 text-xs font-semibold text-muted-foreground'>
					<span>Nesta fatura</span>
					<span>{purchases.length} {purchases.length === 1 ? 'lançamento' : 'lançamentos'}</span>
				</div>
				{is_transactions_loading && <Skeleton className='h-14 w-full rounded-2xl' />}
				{!is_transactions_loading && purchases.length === 0 && (
					<p className='py-6 text-center text-sm text-muted-foreground'>Nenhuma compra nesta fatura</p>
				)}
				{groupTransactionsByDay(purchases).map((group) => {
					/* Total do dia: estorno/pagamento soma, compra subtrai (rascunho fora) — igual a lista da Home. */
					const net = group.items.filter((item) => !item.draft).reduce((acc, item) => acc + (item.kind === 'deposit' ? item.value : -item.value), 0);
					const is_collapsed = !open_days.has(group.label);

					return (
						<section key={group.label} aria-label={group.label}>
							<button
								type='button'
								onClick={() => toggleDay(group.label)}
								aria-expanded={!is_collapsed}
								className='flex w-full items-baseline justify-between pb-1 pt-3.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground'
							>
								<span className='flex items-center gap-1.5'>
									{group.label}
									<span className='font-medium opacity-70'>· {group.items.length}</span>
									<ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', is_collapsed && '-rotate-90')} />
								</span>
								{net !== 0 && <span>{net > 0 ? '+' : '−'} {MoneyUtils.formatMoney(Math.abs(net)).replace(/^R\$\s?/, '')}</span>}
							</button>
							<div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', is_collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
								<div className='min-h-0 overflow-hidden'>
									{group.items.map((item) => {
										const number = item.installment_number ?? (item.recurrence_type === 'installment' ? item.recurrence_index : null);
										const total = item.installment_total;
										const is_refund = item.kind === 'deposit';
										return (
											<div key={item.id} className={cn('flex items-center gap-3 border-b border-border py-2.5 last:border-b-0', item.draft && 'opacity-60')}>
												<div className='flex min-w-0 flex-1 flex-col gap-0.5'>
													<span className={cn('flex min-w-0 items-center gap-1.5 text-[15px] font-semibold', item.projected && 'text-muted-foreground')}>
														<span className='truncate'>{item.description}</span>
														{item.recurrence_type === 'recurring' && <Repeat className='h-3 w-3 shrink-0 text-muted-foreground' aria-label='Recorrente' />}
													</span>
													<span className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
														{number && total ? (
															<span className='inline-flex items-center gap-1.5'>
																{number}/{total}
																{total <= 24 && (
																	<span aria-hidden='true' className='flex gap-0.5'>
																		{Array.from({ length: total }, (_unused, index) => (
																			<span key={index} className={cn('h-[3px] w-2 rounded-sm', index < number ? 'bg-primary' : 'bg-border')} />
																		))}
																	</span>
																)}
															</span>
														) : (
															<span>{format(new Date(item.transaction_date), 'HH:mm')}</span>
														)}
														<span>{item.user_name}</span>
														{item.projected && <span>prevista</span>}
													</span>
												</div>
												<span className={cn('shrink-0 text-[15px] font-semibold', is_refund && 'text-success', item.projected && 'text-muted-foreground')}>
													{is_refund ? '+' : ''}{MoneyUtils.formatMoney(item.value).replace(/^R\$\s?/, '')}
												</span>
											</div>
										);
									})}
								</div>
							</div>
						</section>
					);
				})}
			</div>

			<CreditBalanceFormDialog open={is_edit_open} onOpenChange={setIsEditOpen} creditBalance={creditBalance} />
			<PayInvoiceDialog open={is_pay_open} onOpenChange={setIsPayOpen} creditBalance={creditBalance} invoice={invoice} reference={invoice_month} />
			<InvoiceReviewDialog open={is_review_open} onOpenChange={setIsReviewOpen} creditBalance={creditBalance} />
			<MatchReviewDialog
				open={is_match_review_open}
				onOpenChange={setIsMatchReviewOpen}
				source={{ type: 'CreditBalance', id: creditBalance.id, name: creditBalance.name }}
			/>
			<CreditCardFormDialog open={Boolean(editing_card)} onOpenChange={(open) => !open && setEditingCard(null)} card={editing_card} />

			<AlertDialog open={is_delete_open} onOpenChange={setIsDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir crédito</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja excluir "{creditBalance.name}"? Os cartões e transações vinculados também serão removidos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_balance_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteBalance} disabled={is_delete_balance_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={Boolean(deleting_card)} onOpenChange={(open) => !open && setDeletingCard(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir cartão</AlertDialogTitle>
						<AlertDialogDescription>Deseja excluir o cartão "{deleting_card?.name}"?</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_card_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteCard} disabled={is_delete_card_pending}>Excluir</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
};

/* Final do primeiro plástico de cada crédito (só pra decorar o cartão grande com "•••• 4821"). */
const useFirstLastDigits = (credit_balance_id?: string) => {
	const { data } = useIndexCreditCards({ enabled: Boolean(credit_balance_id), params: { credit_balance_id: credit_balance_id || '' } });
	return data?.data.find((card) => card.last_digits)?.last_digits ?? null;
};

/*
 * Cartões (redesign 2026-11, como no mockup): o cartão selecionado aparece como cartão "físico" e os outros
 * em lista compacta; ao lado (desktop/tablet deitado) ou embaixo, o detalhe da fatura dele. No celular os
 * cartões viram um carrossel com pontinhos.
 */
const CreditBalanceList = ({ createRequest = 0 }: { createRequest?: number }) => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();

	const wallet_id = user_wallet.data?.id;
	const { data: credit_balances_data, isLoading: is_credit_loading } = useIndexCreditBalances({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});

	const [ is_create_open, setIsCreateOpen ] = useState(false);
	/* "+" da barra flutuante (FinancesPage): cada incremento abre o formulário de criação. */
	const last_create_request = useRef(createRequest);
	useEffect(() => {
		if (createRequest === last_create_request.current) return;
		last_create_request.current = createRequest;
		setIsCreateOpen(true);
	}, [ createRequest ]);
	const [ selected_id, setSelectedId ] = useState<string | null>(null);
	const carousel_ref = useRef<HTMLDivElement>(null);

	const credit_balances = credit_balances_data?.data || [];
	const is_loading = is_wallet_loading || is_credit_loading;
	const selected = credit_balances.find((item) => item.id === selected_id) ?? credit_balances[0];
	const selected_index = Math.max(0, credit_balances.findIndex((item) => item.id === selected?.id));
	const last_digits = useFirstLastDigits(selected?.id);

	/* Se o selecionado sumir (excluído, troca de carteira), volta pro primeiro. */
	useEffect(() => {
		if (selected_id && !credit_balances.some((item) => item.id === selected_id)) setSelectedId(null);
	}, [ credit_balances, selected_id ]);

	/* Carrossel do celular: o cartão que para no centro vira o selecionado. */
	const handleCarouselScroll = () => {
		const element = carousel_ref.current;
		if (!element || !element.firstElementChild) return;
		const item_width = (element.firstElementChild as HTMLElement).offsetWidth + 12;
		const index = Math.round(element.scrollLeft / item_width);
		const next = credit_balances[Math.min(credit_balances.length - 1, Math.max(0, index))];
		if (next && next.id !== selected?.id) setSelectedId(next.id);
	};
	const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
		const child = carousel_ref.current?.children[index] as HTMLElement | undefined;
		child?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
	};

	/*
	 * O selecionado pode mudar fora do carrossel (veio de outro tamanho de tela, ou é o primeiro ao abrir):
	 * leva o carrossel até ele. Quando a mudança veio do próprio arrasto, ele já está no centro e nada acontece.
	 */
	useEffect(() => {
		const element = carousel_ref.current;
		if (!element) return undefined;

		const sync = () => {
			const first = element.firstElementChild as HTMLElement | null;
			if (!first || !first.offsetWidth) return;
			const current_index = Math.round(element.scrollLeft / (first.offsetWidth + 12));
			if (current_index !== selected_index) scrollToIndex(selected_index, 'auto');
		};
		sync();

		/* Escondido no tablet/desktop (`md:hidden`): quando volta a aparecer (tela mudou de tamanho), sincroniza de novo. */
		const observer = new ResizeObserver(sync);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ selected_index, credit_balances.length ]);

	/* Seta do cartão: anda N posições, dando a volta no fim/começo da lista. */
	const [ direction, setDirection ] = useState<'next' | 'prev'>('next');
	const selectByOffset = (offset: number) => {
		const next = credit_balances[(selected_index + offset + credit_balances.length) % credit_balances.length];
		if (!next) return;
		setDirection(offset < 0 ? 'prev' : 'next');
		setSelectedId(next.id);
	};

	const add_button = (
		<button
			type='button'
			onClick={() => setIsCreateOpen(true)}
			disabled={!wallet_id}
			className='pressable flex h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-muted-foreground/40 text-sm font-medium text-muted-foreground hover:text-foreground max-md:hidden'
		>
			<Plus className='h-4 w-4' />
			Adicionar cartão
		</button>
	);

	return (
		<div className='flex flex-col gap-4 pb-3'>
			{is_loading && (
				<div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]'>
					<Skeleton className='aspect-[318/192] w-full rounded-3xl' />
					<Skeleton className='h-80 w-full rounded-3xl' />
				</div>
			)}

			{!is_loading && credit_balances.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
					<span className='flex h-14 w-14 items-center justify-center rounded-2xl bg-accent'>
						<CreditCardIcon className='h-6 w-6 text-muted-foreground' />
					</span>
					<div className='flex flex-col gap-1'>
						<span className='font-semibold'>Nenhum cartão ainda</span>
						<span className='text-sm text-muted-foreground'>Cadastre um cartão de crédito com limite, melhor dia de compra e vencimento.</span>
					</div>
					<Button type='button' variant='secondary' onClick={() => setIsCreateOpen(true)} disabled={!wallet_id}>
						<Plus className='h-4 w-4' />
						Novo cartão
					</Button>
				</div>
			)}

			{!is_loading && selected && wallet_id && (
				<div className='grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]'>
					{/* Celular: carrossel de cartões + pontinhos */}
					<div className='flex flex-col gap-3 md:hidden'>
						<div
							ref={carousel_ref}
							onScroll={handleCarouselScroll}
							className='no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4'
						>
							{credit_balances.map((credit_balance) => (
								<div key={credit_balance.id} className='w-[84%] max-w-[340px] shrink-0 snap-center'>
									<BigCard
										creditBalance={credit_balance}
										lastDigits={credit_balance.id === selected.id ? last_digits : null}
										className={cn('transition-transform duration-300', credit_balance.id !== selected.id && 'scale-[0.94] opacity-70')}
									/>
								</div>
							))}
						</div>
						<div className='flex items-center justify-between'>
							<div className='flex gap-1.5'>
								{credit_balances.map((credit_balance, index) => (
									<button
										key={credit_balance.id}
										type='button'
										aria-label={`Ver ${ credit_balance.name }`}
										onClick={() => scrollToIndex(index)}
										className={cn('h-1.5 rounded-full transition-all duration-300', index === selected_index ? 'w-[18px] bg-foreground' : 'w-1.5 bg-border')}
									/>
								))}
							</div>
							<Button type='button' variant='outline' size='sm' onClick={() => setIsCreateOpen(true)}>
								<Plus className='h-4 w-4' />
								Novo cartão
							</Button>
						</div>
					</div>

					{/*
					 * Tablet/desktop: só o cartão selecionado, trocado pelas setas ao lado do nome (circular) e pelos
					 * pontinhos. Já houve uma lista dos outros cartões embaixo; como o selecionado saía dela, a lista
					 * parecia mudar de ordem a cada clique — o dono pediu as setas no lugar.
					 */}
					<div className='hidden min-w-0 flex-col gap-3 md:flex md:max-w-[440px] lg:max-w-none'>
						<BigCard
							creditBalance={selected}
							lastDigits={last_digits}
							onPrev={credit_balances.length > 1 ? () => selectByOffset(-1) : undefined}
							onNext={credit_balances.length > 1 ? () => selectByOffset(1) : undefined}
							direction={direction}
						/>
						<div className='flex items-center justify-between gap-3'>
							<div className='flex gap-1.5'>
								{credit_balances.map((credit_balance, index) => (
									<button
										key={credit_balance.id}
										type='button'
										aria-label={`Ver ${ credit_balance.name }`}
										onClick={() => {
											setDirection(index < selected_index ? 'prev' : 'next');
											setSelectedId(credit_balance.id);
										}}
										className={cn('h-1.5 rounded-full transition-all duration-300', index === selected_index ? 'w-[18px] bg-foreground' : 'w-1.5 bg-border hover:bg-muted-foreground')}
									/>
								))}
							</div>
							<span className='text-xs text-muted-foreground'>{selected_index + 1} de {credit_balances.length}</span>
						</div>
						{add_button}
					</div>

					<CreditBalanceDetail key={selected.id} creditBalance={selected} walletId={wallet_id} />
				</div>
			)}

			<NewCardDialog open={is_create_open} onOpenChange={setIsCreateOpen} />
		</div>
	);
};

export default CreditBalanceList;
