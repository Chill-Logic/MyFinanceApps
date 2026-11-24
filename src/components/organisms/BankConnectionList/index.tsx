import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BankConnectionUtils, getApiErrorMessage, indexBankAccountLinks, QUERY_KEYS, type TBankConnection } from '@myfinance/shared';
import { useQueries } from '@tanstack/react-query';
import {
	ChevronRight,
	CreditCard,
	Landmark,
	Link2,
	ListChecks,
	MoreVertical,
	Plus,
	RefreshCw,
	ShieldCheck,
	TriangleAlert,
	Unplug,
} from 'lucide-react';

import { useIndexAccounts } from '@/hooks/api/accounts/useIndexAccounts';
import { useDeleteBankConnection } from '@/hooks/api/bank-connections/useDeleteBankConnection';
import { useIndexBankConnections } from '@/hooks/api/bank-connections/useIndexBankConnections';
import { useIndexCreditBalances } from '@/hooks/api/credit-balances/useIndexCreditBalances';
import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';
import useBankConnectionRefresh from '@/hooks/useBankConnectionRefresh';
import useBankConnectWidget from '@/hooks/useBankConnectWidget';
import useToast from '@/hooks/useToast';

import { useWallet } from '@/context/wallet';
import { cn } from '@/lib/utils';
import { plural, STATUS_DOT, STATUS_NOTE, STATUS_TEXT, summarizeLinks } from '@/util/bankView';

import Button from '@/components/atoms/Button';
import ConnectorLogo from '@/components/molecules/ConnectorLogo';
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
import Badge from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';

interface IProps {
	/* "Conectar banco" do cabeçalho da página: cada incremento abre o widget. */
	connectRequest?: number;
}

/*
 * Aba Bancos (redesign 2026-11, mockup v3): um cartão por conexão com status em palavras, "atualizado há X" (pela
 * última importação — o backend não grava `last_synced_at`), o resumo da última importação, a contagem de contas
 * e cartões e a sincronização automática. Ao lado (embaixo, fora do desktop): "Para conferir" (contas/cartões com
 * conciliação pendente) e "Como funciona".
 */
const BankConnectionList = ({ connectRequest = 0 }: IProps) => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { toast } = useToast();
	const navigate = useNavigate();

	const wallet_id = user_wallet.data?.id || '';
	const { data: connections_data, isLoading: is_connections_loading } = useIndexBankConnections({
		enabled: Boolean(wallet_id),
		params: { wallet_id },
	});
	const { data: accounts_data } = useIndexAccounts({ enabled: Boolean(wallet_id), params: { wallet_id, per_page: 100 } });
	const { data: credits_data } = useIndexCreditBalances({ enabled: Boolean(wallet_id), params: { wallet_id, per_page: 100 } });
	const { mutate: deleteConnectionMutation, isPending: is_delete_pending } = useDeleteBankConnection();

	const [ deleting_connection, setDeletingConnection ] = useState<TBankConnection | null>(null);
	const [ reviewing, setReviewing ] = useState<TMatchReviewSource | null>(null);

	const connections = connections_data?.data || [];
	const is_loading = is_wallet_loading || is_connections_loading;

	/* Vínculos de cada conexão (mesma chave do `useIndexBankAccountLinks`, cache compartilhado com "Contas do banco"). */
	const links_results = useQueries({
		queries: connections.map((connection) => ({
			queryKey: [ QUERY_KEYS.bank_account_link.get_all, connection.id ],
			queryFn: async() => indexBankAccountLinks(getAxiosInstance(), { bank_connection_id: connection.id, per_page: 50 }),
		})),
	});
	const links_of = (index: number) => links_results[index]?.data?.data ?? [];

	const openAccounts = (connection: Pick<TBankConnection, 'id'>) => navigate(`/contas/bancos/${ connection.id }`);
	const widget = useBankConnectWidget({ wallet_id, onCreated: openAccounts });

	const { refresh, refreshing_id } = useBankConnectionRefresh({
		onFinished: ({ imports }) => widget.notifyImports(imports),
		onFailed: (error, message) => toast.error(message || getApiErrorMessage(error, 'Erro ao atualizar a conexão')),
	});

	/* Botão do cabeçalho da página. */
	const last_request = useRef(connectRequest);
	useEffect(() => {
		if (connectRequest === last_request.current) return;
		last_request.current = connectRequest;
		widget.open();
	}, [ connectRequest ]);

	const handleConfirmDelete = () => {
		if (!deleting_connection) return;

		deleteConnectionMutation({
			id: deleting_connection.id,
			onSuccess: () => {
				toast.success('Banco desconectado');
				setDeletingConnection(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao desconectar o banco'));
				setDeletingConnection(null);
			},
		});
	};

	/* Contas/cartões com transações do banco esperando conferência. */
	const to_review: (TMatchReviewSource & { count: number; kind: 'conta' | 'cartão' })[] = [
		...(accounts_data?.data ?? []).filter((item) => item.pending_match_reviews_count > 0)
			.map((item) => ({ type: 'Account' as const, id: item.id, name: item.name, count: item.pending_match_reviews_count, kind: 'conta' as const })),
		...(credits_data?.data ?? []).filter((item) => item.pending_match_reviews_count > 0)
			.map((item) => ({ type: 'CreditBalance' as const, id: item.id, name: item.name, count: item.pending_match_reviews_count, kind: 'cartão' as const })),
	];
	const review_by_target = new Map(to_review.map((item) => [ item.id, item.count ]));
	const total_to_review = to_review.reduce((acc, item) => acc + item.count, 0);

	const needs_reconnect = connections.filter((connection) => BankConnectionUtils.needsReconnect(connection.status));

	const connectionCard = (connection: TBankConnection, index: number) => {
		const links = links_of(index);
		const summary = summarizeLinks(links);
		const is_busy = widget.syncing_id === connection.id || refreshing_id === connection.id;
		const is_updating = is_busy || BankConnectionUtils.isUpdating(connection.status);
		const status = is_busy ? { label: 'Buscando no banco…', tone: 'info' as const, note: undefined } : BankConnectionUtils.statusView(connection.status);
		const reconnect = BankConnectionUtils.needsReconnect(connection.status);
		const updated_at = BankConnectionUtils.lastUpdatedAt(connection, links);
		const review_count = summary.linked.reduce((acc, link) => acc + (link.target_id ? review_by_target.get(link.target_id) ?? 0 : 0), 0);
		const name = connection.connector_name || 'Banco';

		const badges = (
			<>
				{review_count > 0 && <Badge variant='info'><ListChecks className='size-3' />{review_count} para conferir</Badge>}
				{summary.pending.length > 0 && <Badge variant='warning'>{summary.pending.length} esperando destino</Badge>}
			</>
		);

		const primaryAction = (
			<Button
				type='button'
				variant={reconnect ? 'default' : 'outline'}
				onClick={() => (reconnect ? widget.open(connection) : refresh(connection))}
				disabled={is_updating || widget.is_token_pending || (Boolean(refreshing_id) && !reconnect)}
				className='h-10 gap-2 px-4'
			>
				{reconnect ? <Link2 className='size-4' /> : <RefreshCw className={cn('size-4', is_updating && 'animate-spin')} />}
				{reconnect && 'Reconectar'}
				{!reconnect && (is_updating ? 'Atualizando…' : 'Atualizar')}
			</Button>
		);

		const menu = (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type='button' variant='outline' size='icon' aria-label={`Ações de ${ name }`} className='size-10 shrink-0'>
						<MoreVertical className='size-4' />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end' className='w-52'>
					<DropdownMenuItem onClick={() => refresh(connection)} disabled={is_updating || Boolean(refreshing_id)}>
						<RefreshCw className='mr-2 size-4' />
						Atualizar agora
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => openAccounts(connection)}>
						<ListChecks className='mr-2 size-4' />
						Contas do banco
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => widget.open(connection)} disabled={widget.is_token_pending}>
						<Link2 className='mr-2 size-4' />
						Reconectar
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setDeletingConnection(connection)} className='text-destructive focus:text-destructive'>
						<Unplug className='mr-2 size-4' />
						Desconectar
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);

		let sync_value = 'Ligada';
		if (summary.auto.length === 0) sync_value = 'Desligada';
		else if (summary.auto.length === summary.linked.length && summary.linked.length > 1) sync_value = `Ligada nas ${ summary.linked.length } vinculadas`;
		let sync_hint = 'uma vez por dia';
		if (summary.auto.length === 0) sync_hint = 'só importações manuais';
		else if (reconnect) sync_hint = 'parada até reconectar';

		const links_parts = [
			summary.linked.length ? plural(summary.linked.length, 'vinculada', 'vinculadas') : null,
			summary.pending.length ? `${ summary.pending.length } esperando destino` : null,
			summary.ignored.length ? plural(summary.ignored.length, 'ignorada', 'ignoradas') : null,
		].filter(Boolean);

		const last_import_line = summary.last_import
			? `${ BankConnectionUtils.whenLabel(summary.last_import.created_at) } · ${ BankConnectionUtils.importTriggerLabel(summary.last_import.trigger).toLowerCase() }`
			: null;

		return (
			<article key={connection.id} className={cn(SURFACE, 'flex flex-col gap-4 rounded-3xl p-4 md:p-5')}>
				<header className='flex items-center gap-3'>
					<button type='button' onClick={() => openAccounts(connection)} className='flex min-w-0 flex-1 items-center gap-3 text-left' aria-label={`Contas do banco ${ name }`}>
						<ConnectorLogo connection={connection} className='size-11 md:size-12' />
						<span className='flex min-w-0 flex-col gap-0.5'>
							<span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
								<span className='text-lg font-bold tracking-[-0.02em]'>{name}</span>
								<span className='hidden flex-wrap gap-1.5 md:flex'>{badges}</span>
							</span>
							<span className='flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground'>
								<span className={cn('inline-flex items-center gap-1.5 font-semibold', STATUS_TEXT[status.tone])}>
									{status.tone === 'info'
										? <RefreshCw className='size-3.5 animate-spin' />
										: <span className={cn('size-2 rounded-full', STATUS_DOT[status.tone])} />}
									{status.label}
								</span>
								<span>· {updated_at ? `atualizado ${ BankConnectionUtils.relativeTime(updated_at) }` : 'nada importado ainda'}</span>
							</span>
						</span>
					</button>
					<div className='hidden shrink-0 items-center gap-2 md:flex'>
						{primaryAction}
						{menu}
					</div>
					<ChevronRight className='size-5 shrink-0 text-muted-foreground md:hidden' />
				</header>

				{status.note && !is_busy && (
					<p className={cn('rounded-2xl px-4 py-3 text-sm', STATUS_NOTE[status.tone])}>{status.note}</p>
				)}
				{is_busy && <p className={cn('rounded-2xl px-4 py-3 text-sm', STATUS_NOTE.info)}>Pode levar alguns minutos. Pode sair desta tela: o que chegar entra sozinho.</p>}

				<div className='grid gap-3 border-t border-border pt-4 md:grid-cols-3'>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<span className='text-xs text-muted-foreground'>
							Última importação<span className='md:hidden'>{last_import_line && ` · ${ last_import_line }`}</span>
						</span>
						<span className='font-semibold'>{summary.last_import ? BankConnectionUtils.shortImportSummary(summary.last_import) : 'Nenhuma ainda'}</span>
						{last_import_line && <span className='hidden text-xs text-muted-foreground md:block'>{last_import_line}</span>}
					</div>
					<div className='hidden min-w-0 flex-col gap-0.5 md:flex'>
						<span className='text-xs text-muted-foreground'>Contas e cartões</span>
						<span className='font-semibold'>{links_parts.length ? links_parts.join(' · ') : '—'}</span>
					</div>
					<div className='hidden min-w-0 flex-col gap-0.5 md:flex'>
						<span className='text-xs text-muted-foreground'>Sincronização automática</span>
						<span className='font-semibold'>{sync_value}</span>
						<span className='text-xs text-muted-foreground'>{sync_hint}</span>
					</div>
				</div>

				{/* Celular: selos, e as ações embaixo. */}
				<div className='flex items-center gap-2 md:hidden'>
					<div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
						{badges}
						{review_count === 0 && summary.pending.length === 0 && <span className='text-xs text-muted-foreground'>{links_parts.join(' · ')}</span>}
					</div>
					{primaryAction}
					{menu}
				</div>
			</article>
		);
	};

	const reviewCard = (
		<section className={cn(SURFACE, 'flex flex-col gap-3 rounded-3xl p-5')}>
			<div className='flex items-center justify-between'>
				<h3 className='font-bold'>Para conferir</h3>
				{total_to_review > 0 && <Badge variant='info'><ListChecks className='size-3' />{total_to_review}</Badge>}
			</div>
			<p className='text-sm text-muted-foreground'>
				{total_to_review > 0
					? 'O banco trouxe transações parecidas com algo já lançado. Diga se é a mesma coisa para não duplicar.'
					: 'Nada para conferir. Quando o banco trouxer algo parecido com o que você já lançou, aparece aqui.'}
			</p>
			<ul className='flex flex-col divide-y divide-border'>
				{to_review.map((item) => (
					<li key={item.id} className='flex items-center gap-3 py-3'>
						<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'>
							{item.type === 'CreditBalance' ? <CreditCard className='size-[18px]' /> : <Landmark className='size-[18px]' />}
						</span>
						<span className='flex min-w-0 flex-1 flex-col'>
							<span className='truncate font-semibold'>{item.name}</span>
							<span className='text-xs text-muted-foreground'>{item.kind} · {plural(item.count, 'transação', 'transações')}</span>
						</span>
						<Button type='button' variant='outline' onClick={() => setReviewing(item)} className='h-9 px-4'>Conferir</Button>
					</li>
				))}
			</ul>
		</section>
	);

	const howCard = (
		<section className={cn(SURFACE, 'flex flex-col gap-3 rounded-3xl p-5')}>
			<h3 className='flex items-center gap-2 font-bold'><ShieldCheck className='size-4' />Como funciona</h3>
			<ol className='flex flex-col gap-3'>
				{[
					[ 'Conecte', 'Você entra no banco pela Pluggy (Open Finance). Só leitura: o app nunca movimenta dinheiro.' ],
					[ 'Escolha o destino', 'Conta por conta: criar uma nova, juntar com uma que já existe ou não importar.' ],
					[ 'Importe e deixe rodar', 'Traga até 12 meses de histórico e ligue a sincronização automática diária.' ],
				].map(([ title, text ], index) => (
					<li key={title} className='flex gap-3'>
						<span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold'>{index + 1}</span>
						<span className='flex flex-col'>
							<span className='font-semibold'>{title}</span>
							<span className='text-sm text-muted-foreground'>{text}</span>
						</span>
					</li>
				))}
			</ol>
		</section>
	);

	return (
		<div className='flex flex-col gap-4'>
			<p className='text-sm text-muted-foreground'>Conecte um banco e escolha, conta por conta, o que importar para esta carteira.</p>

			<div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start'>
				<div className='flex min-w-0 flex-col gap-3'>
					{needs_reconnect.length > 0 && (
						<div className='flex items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-destructive'>
							<TriangleAlert className='size-4 shrink-0' />
							<span className='min-w-0 flex-1'>
								{needs_reconnect.length === 1
									? `O ${ needs_reconnect[0].connector_name || 'banco' } precisa que você entre de novo para voltar a atualizar.`
									: `${ needs_reconnect.length } bancos precisam que você entre de novo para voltar a atualizar.`}
							</span>
							{needs_reconnect.length === 1 && (
								<button type='button' onClick={() => widget.open(needs_reconnect[0])} className='shrink-0 font-bold underline underline-offset-2'>
									Reconectar
								</button>
							)}
						</div>
					)}

					{widget.is_creating && (
						<div className='flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground'>
							<RefreshCw className='size-4 animate-spin' />
							Salvando a conexão…
						</div>
					)}

					{is_loading && Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className='h-40 w-full rounded-3xl' />)}

					{!is_loading && connections.length === 0 && !widget.is_creating && (
						<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center'>
							<Link2 className='size-9 text-muted-foreground' />
							<div className='flex flex-col gap-1'>
								<span className='font-semibold'>Nenhum banco conectado</span>
								<span className='text-sm text-muted-foreground'>Conecte um banco para importar contas, cartões e transações.</span>
							</div>
							<Button type='button' onClick={() => widget.open()} isLoading={widget.is_opening} className='mt-1 gap-2'>
								{!widget.is_opening && <Plus className='size-4' />}
								Conectar banco
							</Button>
						</div>
					)}

					{!is_loading && connections.map(connectionCard)}

					{!is_loading && connections.length > 0 && (
						<button
							type='button'
							onClick={() => widget.open()}
							disabled={widget.is_opening}
							className='pressable flex h-16 items-center justify-center gap-2 rounded-3xl border border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground max-md:hidden'
						>
							{widget.is_opening ? <RefreshCw className='size-4 animate-spin' /> : <Plus className='size-4' />}
							Conectar outro banco
						</button>
					)}
				</div>

				<aside className='grid gap-4 md:grid-cols-2 xl:grid-cols-1'>
					{reviewCard}
					<div className='flex flex-col gap-3'>
						{howCard}
						<p className='flex items-center gap-2 px-2 text-xs text-muted-foreground'>
							<ShieldCheck className='size-3.5' />
							Open Finance via Pluggy · até 12 meses de histórico
						</p>
					</div>
				</aside>
			</div>

			{widget.element}

			<MatchReviewDialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)} source={reviewing} />

			<AlertDialog open={Boolean(deleting_connection)} onOpenChange={(open) => !open && setDeletingConnection(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Desconectar banco</AlertDialogTitle>
						<AlertDialogDescription>
							Deseja desconectar "{deleting_connection?.connector_name || 'Banco'}"? As contas, cartões e transações já importados
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

export default BankConnectionList;
