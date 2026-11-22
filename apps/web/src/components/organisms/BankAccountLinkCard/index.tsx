import { useEffect, useState } from 'react';

import { BANK_BEST_PURCHASE_DAY_HELP, BankConnectionUtils, DateUtils, getApiErrorMessage, MONTH_NAMES_PT, MoneyUtils, type TBankAccountLink } from '@myfinance/shared';
import { Ban, CreditCard, Download, GitMerge, History, Landmark, ListChecks, Plus, TriangleAlert } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useUpdateBankAccountLink } from '@/hooks/api/bank-account-links/useUpdateBankAccountLink';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import BankImportDialog from '@/components/organisms/BankImportDialog';
import Badge from '@/components/ui/badge';
import { FIELD_SURFACE } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Switch from '@/components/ui/switch';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const STAT = 'flex min-w-0 flex-col gap-1 rounded-2xl border border-border p-3.5';

interface IProps {
	link: TBankAccountLink;
	/* Carteira da conexão — o destino tem que ser dela. */
	walletId: string;
	/* Desktop: o card cujo histórico está no painel ao lado. */
	selected?: boolean;
	onShowHistory: (link: TBankAccountLink)=> void;
	/* Transações do destino esperando conferência (conciliação). */
	reviewCount?: number;
	onReview?: ()=> void;
}

/* `external_data` vem em REAIS (float). */
const reais = (value?: number) => (value === undefined || value === null ? null : MoneyUtils.formatMoney(Math.round(Math.abs(value) * 100)));

/* "2026-12-10..." → "10 dez" (só a parte da data, sem fuso). */
const dayMonth = (iso?: string) => {
	if (!iso) return null;
	const [ , month, day ] = iso.split('T')[0].split('-').map(Number);
	return month ? `${ day } ${ MONTH_NAMES_PT[month - 1]?.slice(0, 3).toLowerCase() }` : null;
};

const targetValue = (link: TBankAccountLink) => {
	if (link.status === 'linked' && link.target_id) return link.target_id;
	if (link.status === 'ignored') return 'none';
	return '';
};

/*
 * Uma conta ou cartão que veio da conexão (redesign 2026-11, mockup v3). Sem destino: três opções à vista (criar,
 * juntar com uma que já existe, não importar). Ignorada: recolhida, com "Mudar". Vinculada: o destino num select,
 * os dados do cartão como o banco informa (crédito disponível, fechamento, vencimento), o melhor dia de compra
 * pendente de confirmação, a sincronização automática e a última importação.
 */
const BankAccountLinkCard = ({ link, walletId, selected = false, onShowHistory, reviewCount = 0, onReview }: IProps) => {
	const { toast } = useToast();
	const is_credit = link.external_type === 'CREDIT';

	const { data: accounts_data } = useIndexAccounts({ enabled: !is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { data: credit_balances_data } = useIndexCreditBalances({ enabled: is_credit, params: { wallet_id: walletId, per_page: 100 } });
	const { mutate: updateLinkMutation, isPending } = useUpdateBankAccountLink();

	const [ is_import_open, setIsImportOpen ] = useState(false);
	const [ changing, setChanging ] = useState(false);
	const [ merging, setMerging ] = useState(false);
	const [ best_purchase_day, setBestPurchaseDay ] = useState(String(link.suggested_best_purchase_day ?? ''));
	/* Já confirmado: o dia fica numa linha com "Mudar", que abre o mesmo editor (o backend aceita de novo). */
	const [ editing_best_day, setEditingBestDay ] = useState(false);

	useEffect(() => {
		setBestPurchaseDay(String(link.suggested_best_purchase_day ?? ''));
	}, [ link.suggested_best_purchase_day ]);

	const targets = (is_credit ? credit_balances_data?.data : accounts_data?.data) || [];
	const is_linked = link.status === 'linked';
	const is_ignored = link.status === 'ignored';
	const choosing = link.status === 'pending' || changing;
	const Icon = is_credit ? CreditCard : Landmark;
	const noun = is_credit ? { one: 'cartão', new: 'Criar cartão novo', merge: 'Juntar com um cartão', this: 'este cartão', existing: 'Usa um cartão que já existe aqui.', pick: 'Escolha o cartão' }
		: { one: 'conta', new: 'Criar conta nova', merge: 'Juntar com uma conta', this: 'esta conta', existing: 'Usa uma conta que já existe aqui.', pick: 'Escolha a conta' };
	const needs_best_purchase_day = is_credit && is_linked && link.best_purchase_day_status === 'pending';
	const linked_credit = is_credit && is_linked ? credit_balances_data?.data?.find((item) => item.id === link.target_id) : undefined;
	const current_best_day = linked_credit?.best_purchase_day;
	const shows_best_day_row = is_credit && is_linked && !needs_best_purchase_day && current_best_day !== undefined;
	const best_purchase_day_number = Number(best_purchase_day);
	const is_best_purchase_day_valid = Number.isInteger(best_purchase_day_number) && best_purchase_day_number >= 1 && best_purchase_day_number <= 31;

	const credit = link.external_data?.creditData;
	const limit = credit?.creditLimit;
	const available = credit?.availableCreditLimit;
	const balance_label = !is_credit ? reais(link.external_data?.balance) : null;
	/* Cartão: "•••• 4821"; conta: o número como o banco manda (agência/dígito não se mascaram). */
	const number_label = is_credit ? BankConnectionUtils.maskedNumber(link.number) : link.number;
	const subtype = BankConnectionUtils.subtypeLabel(link);
	const subtitle = [ subtype === link.name ? 'Conta' : subtype, number_label, balance_label && `${ balance_label } no banco` ].filter(Boolean).join(' · ');

	const updateLink = (body: Parameters<typeof updateLinkMutation>[0]['body'], success_message: string) => {
		updateLinkMutation({
			id: link.id,
			body,
			onSuccess: () => {
				toast.success(success_message);
				setChanging(false);
				setMerging(false);
				setEditingBestDay(false);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao atualizar o vínculo')),
		});
	};

	const handleTargetChange = (target: string) => {
		const messages: Record<string, string> = {
			new: is_credit ? 'Cartão criado e vinculado' : 'Conta criada e vinculada',
			none: is_credit ? 'Este cartão não será importado' : 'Esta conta não será importada',
		};
		updateLink({ target }, messages[target] || 'Vínculo atualizado');
	};

	const statusBadge = () => {
		if (is_linked) return <Badge variant='success' dot>{is_credit ? 'Vinculado' : 'Vinculada'}</Badge>;
		if (is_ignored) return <Badge variant='neutral'>Não importar</Badge>;
		return <Badge variant='warning' dot>Escolha o destino</Badge>;
	};

	const targetSelect = (placeholder: string) => (
		<Select value={targetValue(link)} onValueChange={handleTargetChange} disabled={isPending}>
			<SelectTrigger className='h-12 rounded-2xl text-[15px] font-semibold'>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value='new'>{noun.new}</SelectItem>
				{targets.map((target) => (
					<SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>
				))}
				{is_linked && link.target_id && !targets.some((target) => target.id === link.target_id) && (
					<SelectItem value={link.target_id}>{link.target_name || 'Destino atual'}</SelectItem>
				)}
				<SelectItem value='none'>Não importar</SelectItem>
			</SelectContent>
		</Select>
	);

	const optionButton = (icon: typeof Plus, title: string, text: string, onClick: ()=> void, active = false) => {
		const OptionIcon = icon;
		return (
			<button
				type='button'
				onClick={onClick}
				disabled={isPending}
				className={cn(
					'pressable flex items-start gap-3 rounded-2xl border border-border p-3.5 text-left transition-colors hover:bg-accent disabled:opacity-50',
					active && 'border-primary bg-primary/10'
				)}
			>
				<OptionIcon className='mt-0.5 size-4 shrink-0' />
				<span className='flex flex-col gap-0.5'>
					<span className='text-sm font-semibold'>{title}</span>
					<span className='text-xs text-muted-foreground'>{text}</span>
				</span>
			</button>
		);
	};

	return (
		<li
			className={cn(
				SURFACE,
				'flex flex-col gap-4 rounded-3xl p-4 transition-[border-color,box-shadow] md:p-5',
				selected && 'lg:border-primary/70 lg:ring-1 lg:ring-primary/40'
			)}
		>
			<div className='flex items-start gap-3'>
				<span className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary'>
					<Icon className='size-[18px]' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='truncate text-[17px] font-bold tracking-[-0.01em]'>{link.name}</p>
					<p className='truncate text-[13px] text-muted-foreground'>{subtitle}</p>
				</div>
				<span className='shrink-0'>{statusBadge()}</span>
			</div>

			{/* Ignorada e não está mudando: uma linha só. */}
			{is_ignored && !changing && (
				<div className='flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm'>
					<span className='text-muted-foreground'>Fica de fora: nada é importado daqui.</span>
					<button type='button' onClick={() => setChanging(true)} className='shrink-0 font-semibold text-brand'>Mudar</button>
				</div>
			)}

			{/* Sem destino (ou mudando): as três opções à vista. */}
			{choosing && (
				<div className='flex flex-col gap-3'>
					<p className='text-sm text-muted-foreground'>
						<strong className='font-semibold text-foreground'>Para onde vai {noun.this}?</strong> Nada é importado até você escolher.
					</p>
					<div className='grid gap-2 md:grid-cols-3'>
						{optionButton(Plus, noun.new, `Cria “${ link.name }” nesta carteira.`, () => handleTargetChange('new'))}
						{optionButton(GitMerge, noun.merge, noun.existing, () => setMerging(true), merging)}
						{optionButton(Ban, 'Não importar', 'Fica de fora. Dá para mudar depois.', () => handleTargetChange('none'), is_ignored)}
					</div>
					{merging && (
						<Select value='' onValueChange={handleTargetChange} disabled={isPending}>
							<SelectTrigger className='h-12 rounded-2xl text-[15px]'>
								<SelectValue placeholder={noun.pick} />
							</SelectTrigger>
							<SelectContent>
								{targets.length === 0 && <div className='px-3 py-2 text-sm text-muted-foreground'>Nenhum {noun.one} nesta carteira.</div>}
								{targets.map((target) => (
									<SelectItem key={target.id} value={target.id}>{target.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{changing && (
						<button type='button' onClick={() => { setChanging(false); setMerging(false); }} className='self-start text-sm text-muted-foreground hover:text-foreground'>
							Cancelar
						</button>
					)}
				</div>
			)}

			{is_linked && !changing && (
				<>
					<div className='flex flex-col gap-2'>
						<div className='flex items-center justify-between gap-2 px-1'>
							<span className='text-[13px] font-medium text-muted-foreground'>Importar para</span>
							{reviewCount > 0 && (
								<button type='button' onClick={onReview} className='pressable'>
									<Badge variant='info'><ListChecks className='size-3' />{reviewCount} para conferir</Badge>
								</button>
							)}
						</div>
						{targetSelect('Escolha o destino')}
					</div>

					{is_credit && (limit !== undefined || credit?.balanceDueDate || credit?.balanceCloseDate) && (
						<div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
							<div className={cn(STAT, 'col-span-2 md:col-span-1')}>
								<span className='text-xs text-muted-foreground'>Crédito disponível</span>
								<span className='text-lg font-bold'>{reais(available) ?? '—'}</span>
								{limit ? (
									<>
										<div className='h-1.5 overflow-hidden rounded-full bg-secondary' aria-hidden='true'>
											<div className='h-full rounded-full bg-primary' style={{ width: `${ Math.min(100, Math.max(0, ((available ?? 0) / limit) * 100)) }%` }} />
										</div>
										<span className='text-xs text-muted-foreground'>de {reais(limit)}</span>
									</>
								) : null}
							</div>
							<div className={STAT}>
								<span className='text-xs text-muted-foreground'>Fechamento</span>
								<span className={cn('text-lg font-bold', !credit?.balanceCloseDate && 'text-muted-foreground')}>{dayMonth(credit?.balanceCloseDate) ?? 'não informado'}</span>
								<span className='text-xs text-muted-foreground'>pelo banco</span>
							</div>
							<div className={STAT}>
								<span className='text-xs text-muted-foreground'>Vencimento</span>
								<span className={cn('text-lg font-bold', !credit?.balanceDueDate && 'text-muted-foreground')}>{dayMonth(credit?.balanceDueDate) ?? 'não informado'}</span>
								<span className='text-xs text-muted-foreground'>{reais(link.external_data?.balance) ? `fatura ${ reais(link.external_data?.balance) }` : 'pelo banco'}</span>
							</div>
						</div>
					)}

					{shows_best_day_row && !editing_best_day && (
						<div className='flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-sm'>
							<span className='flex min-w-0 flex-col gap-0.5'>
								<span className='font-semibold'>Melhor dia de compra · dia {current_best_day}</span>
								<span className='text-xs text-muted-foreground'>A partir dele as compras entram na fatura seguinte.</span>
							</span>
							<button
								type='button'
								onClick={() => { setBestPurchaseDay(String(current_best_day)); setEditingBestDay(true); }}
								className='shrink-0 font-semibold text-brand'
							>
								Mudar
							</button>
						</div>
					)}

					{(needs_best_purchase_day || (shows_best_day_row && editing_best_day)) && (
						<div className={cn('flex flex-col gap-3 rounded-2xl p-4', needs_best_purchase_day ? 'border border-warning-dot/40 bg-warning-soft' : 'bg-secondary/60')}>
							{needs_best_purchase_day ? (
								<p className='flex items-start gap-2 text-sm'>
									<TriangleAlert className='mt-0.5 size-4 shrink-0 text-warning' />
									<span><strong className='font-semibold text-warning'>Confirme o melhor dia de compra.</strong> {BANK_BEST_PURCHASE_DAY_HELP(link.suggested_best_purchase_day)}</span>
								</p>
							) : (
								<p className='text-sm text-muted-foreground'>
									<strong className='font-semibold text-foreground'>Mudar o melhor dia de compra.</strong> Vale para as próximas compras; as que já estão numa fatura continuam onde estão.
								</p>
							)}
							<div className='flex items-center gap-2'>
								<label htmlFor={`best-day-${ link.id }`} className='min-w-0 flex-1 text-[13px] text-muted-foreground'>
									Melhor dia de compra{needs_best_purchase_day && link.suggested_best_purchase_day ? ' · sugerido' : ''}
								</label>
								<input
									id={`best-day-${ link.id }`}
									type='number'
									min={1}
									max={31}
									value={best_purchase_day}
									onChange={(event) => setBestPurchaseDay(event.target.value)}
									className={cn(FIELD_SURFACE, 'h-11 w-16 px-2 text-center text-base font-bold')}
								/>
								<Button
									type='button'
									isLoading={isPending}
									disabled={!is_best_purchase_day_valid}
									onClick={() => updateLink({ best_purchase_day: best_purchase_day_number }, needs_best_purchase_day ? 'Melhor dia de compra confirmado' : 'Melhor dia de compra atualizado')}
									className='h-11 px-5'
								>
									{needs_best_purchase_day ? 'Confirmar' : 'Salvar'}
								</Button>
								{!needs_best_purchase_day && (
									<Button type='button' variant='ghost' onClick={() => setEditingBestDay(false)} className='h-11 px-3'>
										Cancelar
									</Button>
								)}
							</div>
						</div>
					)}

					<div className='flex items-start justify-between gap-4 rounded-2xl bg-secondary/60 p-4'>
						<div className='flex flex-col gap-0.5'>
							<span className='text-sm font-semibold'>Sincronizar automaticamente</span>
							<span className='text-xs text-muted-foreground'>
								{link.auto_sync
									? `Todo dia traz o que é novo${ link.auto_sync_since ? `, desde ${ DateUtils.formatDate(link.auto_sync_since) }` : '' }. Não mexe no que você editou nem volta o que você excluiu.`
									: 'Desligada: só entra o que você importar. Ligando, todo dia traz o que é novo a partir de hoje.'}
							</span>
						</div>
						<Switch
							checked={link.auto_sync}
							disabled={isPending}
							aria-label='Sincronizar automaticamente'
							onCheckedChange={(checked) => updateLink(
								{ auto_sync: checked },
								checked ? 'Sincronização automática ativada' : 'Sincronização automática desativada',
							)}
						/>
					</div>
				</>
			)}

			{(is_linked || link.last_imported_at) && !changing && (
				<div className='flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4'>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<span className='text-xs text-muted-foreground'>
							{link.last_import
								? `Última importação · ${ BankConnectionUtils.whenLabel(link.last_import.created_at).toLowerCase() } · ${ BankConnectionUtils.importTriggerLabel(link.last_import.trigger).toLowerCase() }`
								: 'Última importação'}
						</span>
						<span className='text-sm font-semibold'>{link.last_import ? BankConnectionUtils.shortImportSummary(link.last_import) : 'Nada importado ainda'}</span>
					</div>
					<div className='flex items-center gap-2'>
						<Button type='button' variant='outline' onClick={() => onShowHistory(link)} className='h-10 gap-2 px-4'>
							<History className='size-4' />
							Histórico
						</Button>
						{is_linked && (
							<Button type='button' variant='outline' onClick={() => setIsImportOpen(true)} className='h-10 gap-2 px-4'>
								<Download className='size-4' />
								Importar período
							</Button>
						)}
					</div>
				</div>
			)}

			<BankImportDialog open={is_import_open} onOpenChange={setIsImportOpen} link={link} />
		</li>
	);
};

export default BankAccountLinkCard;
