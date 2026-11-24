import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BankConnectionUtils, getApiErrorMessage, type TBankAccountLink } from '@myfinance/shared';
import { ArrowLeft, Check, History, Link2, ListChecks, MoreVertical, RefreshCw, Unplug } from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useIndexBankAccountLinks } from '@/hooks/api/bank-account-links/useIndexBankAccountLinks';
import { useDeleteBankConnection } from '@/hooks/api/bank-connections/useDeleteBankConnection';
import { useShowBankConnection } from '@/hooks/api/bank-connections/useShowBankConnection';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import useBankConnectionRefresh from '@/hooks/useBankConnectionRefresh';
import useBankConnectWidget from '@/hooks/useBankConnectWidget';
import useMediaQuery from '@/hooks/useMediaQuery';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';
import { STATUS_DOT, STATUS_NOTE, summarizeLinks } from '@/util/bankView';

import Button from '@/components/atoms/Button';
import ConnectorLogo from '@/components/molecules/ConnectorLogo';
import BankAccountLinkCard from '@/components/organisms/BankAccountLinkCard';
import BankImportHistoryDialog, { BankImportHistoryList, linkTitle } from '@/components/organisms/BankImportHistoryDialog';
import MatchReviewDialog, { type TMatchReviewSource } from '@/components/organisms/MatchReviewDialog';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const HERO = 'relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none';
const HERO_GLOW = 'pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]';
const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const CHIP = 'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold';

/* Status no cartão marinho: cores claras (o fundo é sempre escuro). */
const HERO_STATUS_TEXT = { success: 'text-[#9FE0B6]', warning: 'text-[#F2D58A]', error: 'text-[#F5A99F]', info: 'text-[#9CCBEA]', neutral: 'text-[#A9B6BF]' } as const;

/*
 * "Contas do banco" (redesign 2026-11, mockup v3): cartão marinho com a conexão (status, contagens e Atualizar),
 * um card por conta/cartão que a Pluggy trouxe e, do tablet deitado em diante, o histórico de importações do card
 * selecionado num painel ao lado (abaixo disso, o histórico abre numa folha/diálogo).
 */
const BankConnectionPage = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { toast } = useToast();
	const is_wide = useMediaQuery('(min-width: 1024px)');
	const is_desktop = useMediaQuery('(min-width: 1280px)');

	const { data: connection, isLoading: is_connection_loading } = useShowBankConnection({ id });
	const { data: links_data, isLoading: is_links_loading } = useIndexBankAccountLinks({
		enabled: Boolean(id),
		params: { bank_connection_id: id || '' },
	});
	const wallet_id = connection?.wallet_id || '';
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id, per_page: 100 } });
	const { data: credits_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id, per_page: 100 } });
	const { mutate: deleteConnectionMutation, isPending: is_delete_pending } = useDeleteBankConnection();

	const [ history_link_id, setHistoryLinkId ] = useState<string | null>(null);
	const [ history_open, setHistoryOpen ] = useState(false);
	const [ reviewing, setReviewing ] = useState<TMatchReviewSource | null>(null);
	const [ deleting, setDeleting ] = useState(false);

	const links = links_data?.data || [];
	const is_loading = is_connection_loading || is_links_loading;
	const summary = summarizeLinks(links);

	const widget = useBankConnectWidget({ wallet_id });
	const { refresh, refreshing_id } = useBankConnectionRefresh({
		onFinished: ({ imports }) => widget.notifyImports(imports),
		onFailed: (error, message) => toast.error(message || getApiErrorMessage(error, 'Erro ao atualizar a conexão')),
	});

	const review_count_of = (link: TBankAccountLink) => {
		if (link.status !== 'linked' || !link.target_id) return 0;
		const list = link.target_type === 'CreditBalance' ? credits_data?.data : accounts_data?.data;
		return list?.find((item) => item.id === link.target_id)?.pending_match_reviews_count ?? 0;
	};
	const total_to_review = links.reduce((acc, link) => acc + review_count_of(link), 0);

	/* Painel do histórico: o card escolhido, ou o primeiro com importação (ou o primeiro). */
	const history_link = links.find((link) => link.id === history_link_id)
		?? links.find((link) => link.last_imported_at)
		?? links[0]
		?? null;

	const showHistory = (link: TBankAccountLink) => {
		setHistoryLinkId(link.id);
		if (!is_wide) setHistoryOpen(true);
	};

	const handleConfirmDelete = () => {
		if (!connection) return;
		deleteConnectionMutation({
			id: connection.id,
			onSuccess: () => {
				toast.success('Banco desconectado');
				navigate('/accounts?tab=connections');
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao desconectar o banco'));
				setDeleting(false);
			},
		});
	};

	const is_busy = Boolean(connection) && (widget.syncing_id === connection?.id || refreshing_id === connection?.id);
	const status = is_busy ? { label: 'Buscando no banco…', tone: 'info' as const, note: undefined } : BankConnectionUtils.statusView(connection?.status ?? null);
	const reconnect = connection ? BankConnectionUtils.needsReconnect(connection.status) : false;
	const updated_at = connection ? BankConnectionUtils.lastUpdatedAt(connection, links) : null;

	const primaryAction = connection && (
		<Button
			type='button'
			onClick={() => (reconnect ? widget.open(connection) : refresh(connection))}
			disabled={is_busy || widget.is_token_pending || BankConnectionUtils.isUpdating(connection.status)}
			className='h-11 gap-2 px-5 font-bold'
		>
			{reconnect ? <Link2 className='size-4' /> : <RefreshCw className={cn('size-4', is_busy && 'animate-spin')} />}
			{reconnect && 'Reconectar'}
			{!reconnect && (is_busy ? 'Atualizando…' : 'Atualizar')}
		</Button>
	);

	const menu = connection && (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button type='button' aria-label='Mais ações' className='pressable flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sand-light'>
					<MoreVertical className='size-4' />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-52'>
				<DropdownMenuItem onClick={() => widget.open(connection)} disabled={widget.is_token_pending}>
					<Link2 className='mr-2 size-4' />
					Reconectar
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => setDeleting(true)} className='text-destructive focus:text-destructive'>
					<Unplug className='mr-2 size-4' />
					Desconectar
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div className='flex flex-col gap-5'>
			<header className='flex items-center gap-3'>
				<button
					type='button'
					aria-label='Voltar'
					onClick={() => navigate('/accounts?tab=connections')}
					className='pressable flex size-11 shrink-0 items-center justify-center rounded-full border border-border'
				>
					<ArrowLeft className='size-5' />
				</button>
				<div className='min-w-0'>
					<p className='hidden text-xs font-medium text-muted-foreground md:block'>Contas &amp; Cartões · Bancos</p>
					<h1 className='truncate text-xl font-bold tracking-[-0.03em] md:text-[28px]'>Contas do banco</h1>
				</div>
			</header>

			{is_loading && <Skeleton className='h-36 w-full rounded-3xl' />}

			{connection && (
				<section className={cn(HERO, 'p-5 md:p-6')}>
					<div aria-hidden='true' className={HERO_GLOW} />
					<div className='relative flex flex-col gap-4'>
						<div className='flex items-start gap-4'>
							<ConnectorLogo connection={connection} className='size-12 text-lg md:size-14' />
							<div className='flex min-w-0 flex-1 flex-col gap-1'>
								<span className='text-2xl font-bold tracking-[-0.03em] md:text-[28px]'>{connection.connector_name || 'Banco'}</span>
								<span className='flex flex-wrap items-center gap-x-1.5 text-[13px] text-[#A9B6BF]'>
									<span className={cn('inline-flex items-center gap-1.5 font-semibold', HERO_STATUS_TEXT[status.tone])}>
										{status.tone === 'info' ? <RefreshCw className='size-3.5 animate-spin' /> : <span className={cn('size-2 rounded-full', STATUS_DOT[status.tone])} />}
										{status.label}
									</span>
									<span>· {updated_at ? `atualizado ${ BankConnectionUtils.relativeTime(updated_at) }` : 'nada importado ainda'}</span>
									{summary.last_import && (
										<span className='hidden md:inline'>· última importação {BankConnectionUtils.whenLabel(summary.last_import.created_at).toLowerCase()}</span>
									)}
								</span>
							</div>
							<div className='hidden shrink-0 items-center gap-2 md:flex'>
								{primaryAction}
								{menu}
							</div>
							<span className='md:hidden'>{menu}</span>
						</div>

						<div className='flex flex-wrap gap-2'>
							{summary.linked.length > 0 && <span className={CHIP}><Check className='size-3.5' />{summary.linked.length} {summary.linked.length === 1 ? 'vinculada' : 'vinculadas'}</span>}
							{summary.pending.length > 0 && <span className={CHIP}><span className='size-1.5 rounded-full bg-warning-dot' />{summary.pending.length} esperando destino</span>}
							{summary.ignored.length > 0 && <span className={CHIP}>{summary.ignored.length} {summary.ignored.length === 1 ? 'ignorada' : 'ignoradas'}</span>}
							{total_to_review > 0 && <span className={cn(CHIP, 'bg-[rgba(110,180,220,0.16)] text-[#9CCBEA]')}><ListChecks className='size-3.5' />{total_to_review} para conferir</span>}
						</div>

						<div className='md:hidden [&>button]:w-full'>{primaryAction}</div>
					</div>
				</section>
			)}

			{connection && status.note && !is_busy && <p className={cn('rounded-2xl px-4 py-3 text-sm', STATUS_NOTE[status.tone])}>{status.note}</p>}

			<p className='text-sm text-muted-foreground'>
				Escolha para onde cada conta ou cartão do banco vai. Nada é importado até você importar um período ou ligar a sincronização automática.
			</p>

			{is_loading && Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className='h-48 w-full rounded-3xl' />)}

			{!is_loading && links.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-12 text-center'>
					<Link2 className='size-9 text-muted-foreground' />
					<span className='font-semibold'>Nenhuma conta encontrada nesta conexão</span>
				</div>
			)}

			{!is_loading && connection && links.length > 0 && (
				<div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]'>
					<ul className='flex min-w-0 flex-col gap-3'>
						{links.map((link) => (
							<BankAccountLinkCard
								key={link.id}
								link={link}
								walletId={connection.wallet_id}
								selected={is_wide && history_link?.id === link.id}
								onShowHistory={showHistory}
								reviewCount={review_count_of(link)}
								onReview={() => link.target_id && link.target_type && setReviewing({ type: link.target_type, id: link.target_id, name: link.target_name || link.name })}
							/>
						))}
					</ul>

					{is_wide && history_link && (
						<aside className={cn(SURFACE, 'no-scrollbar sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto rounded-3xl p-5')}>
							<div className='flex items-start justify-between gap-3'>
								<div className='flex min-w-0 flex-col'>
									<h2 className='text-lg font-bold tracking-[-0.02em]'>Histórico de importações</h2>
									<span className='truncate text-[13px] text-muted-foreground'>{linkTitle(history_link)}</span>
								</div>
								<History className='size-5 shrink-0 text-muted-foreground' />
							</div>
							<p className='text-sm text-muted-foreground'>
								Manuais e automáticas, da mais recente para a mais antiga. Desfazer apaga o que ela criou e volta o que ela mudou.
							</p>
							<BankImportHistoryList link={history_link} compact={!is_desktop} />
						</aside>
					)}
				</div>
			)}

			<BankImportHistoryDialog open={history_open && !is_wide} onOpenChange={setHistoryOpen} link={history_link} />
			<MatchReviewDialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)} source={reviewing} />
			{widget.element}

			<AlertDialog open={deleting} onOpenChange={(open) => !open && setDeleting(false)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Desconectar banco</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja desconectar "{connection?.connector_name || 'Banco'}"? As contas, cartões e transações já importados
							continuam na carteira, mas deixam de ser atualizados.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_delete_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmDelete} disabled={is_delete_pending}>Desconectar</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default BankConnectionPage;
