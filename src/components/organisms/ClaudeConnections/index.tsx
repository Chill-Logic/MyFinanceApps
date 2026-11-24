import { useEffect, useState } from 'react';

import { BankConnectionUtils, ClaudeSessionUtils, getApiErrorMessage, MONTH_NAMES_PT, type TClaudeSession, type TClaudeToolCall } from '@myfinance/shared';
import { Activity, Bot, Check, ChevronDown, ChevronRight, Copy, Eye, Filter, PenLine, ShieldOff } from 'lucide-react';

import { useIndexClaudeSessions } from '@/hooks/api/claude-sessions/useIndexClaudeSessions';
import { useIndexClaudeToolCalls } from '@/hooks/api/claude-sessions/useIndexClaudeToolCalls';
import { useRevokeClaudeSession } from '@/hooks/api/claude-sessions/useRevokeClaudeSession';
import useMediaQuery from '@/hooks/useMediaQuery';
import useToast from '@/hooks/useToast';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
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

const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';
const PAGE = 50;

const TONE_BADGE = { success: 'success', warning: 'warning', error: 'danger', neutral: 'neutral' } as const;

/* "10 fev 2027" (só a data). */
const shortDate = (iso: string) => {
	const date = new Date(iso);
	return `${ date.getDate() } ${ MONTH_NAMES_PT[date.getMonth()]?.slice(0, 3).toLowerCase() } ${ date.getFullYear() }`;
};
const when = (iso: string) => BankConnectionUtils.whenLabel(iso).toLowerCase();

const sessionStatusBadge = (session: TClaudeSession) => {
	const status = ClaudeSessionUtils.statusLabel(session.status);
	const label = session.status === 'pending' ? 'Aguardando' : status.label;
	return <Badge variant={TONE_BADGE[status.tone]} dot={ClaudeSessionUtils.isRevocable(session)}>{label}</Badge>;
};

/*
 * Atividade de uma conexão (auditoria das ferramentas que o Claude chamou): filtro por ferramenta, a chamada
 * aberta mostra os argumentos, o HTTP e o registro; erro aparece embaixo da linha. `compact` (celular) mostra
 * só as 3 mais recentes, com "Ver toda a atividade".
 */
const ActivityList = ({ session, compact = false }: { session: TClaudeSession; compact?: boolean }) => {
	const [ tool, setTool ] = useState<string | undefined>(undefined);
	const [ per_page, setPerPage ] = useState(PAGE);
	const [ expanded_id, setExpandedId ] = useState<string | null>(null);
	const [ show_all, setShowAll ] = useState(false);
	const { data, isLoading, isFetching } = useIndexClaudeToolCalls({ session_id: session.id, tool, per_page });
	const [ known_tools, setKnownTools ] = useState<Record<string, string>>({});

	const calls = data?.data ?? [];
	const total = data?.total_count ?? calls.length;
	/* Ferramentas conhecidas pra o filtro: acumuladas do que já veio (a API não lista as ferramentas). */
	useEffect(() => {
		if (!data?.data.length) return;
		setKnownTools((previous) => ({ ...previous, ...Object.fromEntries(data.data.map((call) => [ call.tool, call.tool_title ])) }));
	}, [ data ]);
	const tools = known_tools;

	const visible = compact && !show_all ? calls.slice(0, 3) : calls;
	let filter_label = compact ? 'Ferramenta' : 'Todas as ferramentas';
	if (tool) filter_label = tools[tool] ?? tool;

	const row = (call: TClaudeToolCall) => {
		const status = ClaudeSessionUtils.toolCallStatusLabel(call.status);
		const is_open = expanded_id === call.id;
		const Icon = call.kind === 'write' ? PenLine : Eye;
		const kind = call.kind === 'write' ? 'Escrita' : 'Leitura';
		return (
			<li key={call.id} className='py-3'>
				<button type='button' onClick={() => setExpandedId(is_open ? null : call.id)} className='flex w-full items-center gap-3 text-left'>
					<span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary'><Icon className='size-4' /></span>
					<span className='flex min-w-0 flex-1 flex-col'>
						<span className='truncate font-semibold'>{call.tool_title}</span>
						<span className='text-xs text-muted-foreground'>
							{kind}{call.duration_ms !== null ? ` · ${ call.duration_ms } ms` : ''}<span className='md:hidden'> · {when(call.created_at)}</span>
						</span>
					</span>
					<Badge variant={TONE_BADGE[status.tone]} className='shrink-0'>{status.label}</Badge>
					<span className='hidden w-[92px] shrink-0 text-right text-sm text-muted-foreground md:block'>{when(call.created_at)}</span>
					{is_open ? <ChevronDown className='size-4 shrink-0 text-muted-foreground' /> : <ChevronRight className='size-4 shrink-0 text-muted-foreground' />}
				</button>
				{call.error_message && <p className='mt-1.5 pl-11 text-xs text-warning'>{call.http_status ? `HTTP ${ call.http_status } · ` : ''}{call.error_message}</p>}
				{is_open && (
					<div className='mt-2 flex flex-col gap-1.5 rounded-2xl bg-secondary/60 p-3.5 text-xs md:ml-11'>
						<span className='font-semibold text-muted-foreground'>Argumentos</span>
						<pre className='whitespace-pre-wrap break-all font-mono text-[12px] text-foreground'>{JSON.stringify(call.arguments, null, 1).replace(/\n\s*/g, ' ')}</pre>
						<span className='text-muted-foreground'>
							{call.http_status ? `HTTP ${ call.http_status }` : 'Sem resposta HTTP'}
							{call.record_id ? ` · registro ${ call.record_id.slice(0, 8) }` : ''}
						</span>
					</div>
				)}
			</li>
		);
	};

	return (
		<div className='flex flex-col'>
			<div className='flex items-center justify-between gap-3'>
				{compact
					? <span className='text-sm font-semibold'>Atividade · {total} {total === 1 ? 'chamada' : 'chamadas'}</span>
					: null}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button type='button' className='pressable flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold'>
							<Filter className='size-3.5' />
							{filter_label}
							<ChevronDown className='size-3.5 text-muted-foreground' />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='start' className='max-h-72 w-60 overflow-y-auto'>
						<DropdownMenuItem onClick={() => setTool(undefined)}>
							<Check className={cn('mr-2 size-4', tool && 'opacity-0')} />Todas as ferramentas
						</DropdownMenuItem>
						{Object.entries(tools).map(([ key, title ]) => (
							<DropdownMenuItem key={key} onClick={() => setTool(key)}>
								<Check className={cn('mr-2 size-4', tool !== key && 'opacity-0')} />{title}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				{!compact && <span className='text-xs text-muted-foreground'>{total} {total === 1 ? 'chamada' : 'chamadas'} · {calls.length} nesta página</span>}
			</div>

			{!compact && (
				<div className='mt-3 hidden items-center gap-3 border-b border-border pb-2 text-xs font-medium text-muted-foreground md:flex'>
					<span className='flex-1 pl-11'>Ferramenta · tipo · duração</span>
					<span>Status</span>
					<span className='w-[92px] text-right'>Quando</span>
					<span className='w-4' />
				</div>
			)}

			{isLoading && <div className='mt-2 flex flex-col gap-2'>{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className='h-12 w-full rounded-xl' />)}</div>}
			{!isLoading && calls.length === 0 && (
				<div className='flex flex-col items-center gap-2 py-8 text-center'>
					<Activity className='size-8 text-muted-foreground' />
					<span className='font-semibold'>Nenhuma atividade ainda</span>
				</div>
			)}
			<ul className={cn('flex flex-col divide-y divide-border', isFetching && !isLoading && 'opacity-60')}>{visible.map(row)}</ul>

			{compact && !show_all && calls.length > 3 && (
				<Button type='button' variant='outline' onClick={() => setShowAll(true)} className='mt-1 h-11'>Ver toda a atividade</Button>
			)}
			{(!compact || show_all) && total > calls.length && (
				<Button type='button' variant='outline' isLoading={isFetching} onClick={() => setPerPage((count) => count + PAGE)} className='mt-2 h-11 self-center px-6'>
					Carregar mais
				</Button>
			)}
		</div>
	);
};

/*
 * Conexões com o Claude (redesign 2026-11, mockup v3). Endereço do MCP com copiar; conexões atuais e "Revogadas e
 * expiradas"; do tablet deitado em diante a atividade da conexão escolhida fica num painel ao lado (metadados:
 * acesso, validade, token, último uso e IP; filtro por ferramenta; argumentos ao abrir uma chamada; Revogar). No
 * celular, a conexão escolhida abre por dentro do próprio cartão.
 */
const ClaudeConnections = () => {
	const { toast } = useToast();
	const is_wide = useMediaQuery('(min-width: 1024px)');
	const { data, isLoading } = useIndexClaudeSessions();
	const { mutate: revokeMutation, isPending: is_revoke_pending } = useRevokeClaudeSession();

	const [ selected_id, setSelectedId ] = useState<string | null>(null);
	const [ revoking_session, setRevokingSession ] = useState<TClaudeSession | null>(null);
	const [ show_past, setShowPast ] = useState(false);

	const sessions = data?.data || [];
	const current_sessions = sessions.filter(ClaudeSessionUtils.isRevocable);
	const past_sessions = sessions.filter((session) => !ClaudeSessionUtils.isRevocable(session));
	const selected = sessions.find((session) => session.id === selected_id) ?? current_sessions[0] ?? past_sessions[0] ?? null;
	const mcp_url = data?.mcp_url;

	const handleCopy = async() => {
		if (!mcp_url) return;
		try {
			await navigator.clipboard.writeText(mcp_url);
			toast.success('Endereço copiado');
		} catch {
			toast.error('Não foi possível copiar o endereço');
		}
	};

	const handleConfirmRevoke = () => {
		if (!revoking_session) return;
		revokeMutation({
			id: revoking_session.id,
			onSuccess: () => {
				toast.success('Conexão revogada');
				setRevokingSession(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Não foi possível revogar a conexão'));
				setRevokingSession(null);
			},
		});
	};

	const meta = (session: TClaudeSession) => (
		<div className='grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] md:flex md:flex-wrap md:gap-x-4'>
			<span className='text-muted-foreground'>{ClaudeSessionUtils.scopeLabel(session.scope)}</span>
			<span className='text-muted-foreground'>
				{session.status === 'expired' ? 'Expirou em ' : 'Válida até '}<strong className='font-semibold text-foreground'>{shortDate(session.expires_at)}</strong>
			</span>
			{session.token_hint && <span className='text-muted-foreground'>Token <span className='font-mono font-semibold text-foreground'>{session.token_hint}…</span></span>}
			<span className='col-span-2 text-muted-foreground'>
				{session.last_used_at
					? <>Último uso <strong className='font-semibold text-foreground'>{when(session.last_used_at)}</strong>{session.last_used_ip && <> de <span className='font-mono font-semibold text-foreground'>{session.last_used_ip}</span></>}</>
					: 'Ainda não usada'}
			</span>
		</div>
	);

	const revokeButton = (session: TClaudeSession, className?: string) => ClaudeSessionUtils.isRevocable(session) && (
		<Button type='button' variant='ghost' onClick={() => setRevokingSession(session)} className={cn('h-10 gap-2 bg-danger-soft px-4 text-destructive hover:bg-danger-soft hover:text-destructive', className)}>
			<ShieldOff className='size-4' />
			Revogar
		</Button>
	);

	const sessionCard = (session: TClaudeSession) => {
		const is_selected = selected?.id === session.id;
		const is_past = !ClaudeSessionUtils.isRevocable(session);
		let footer = 'Ainda não usada';
		if (session.status === 'revoked' && session.revoked_at) footer = `Revogada em ${ shortDate(session.revoked_at) }`;
		else if (session.status === 'expired') footer = `Expirou em ${ shortDate(session.expires_at) }`;
		else if (session.last_used_at) footer = `Último uso ${ when(session.last_used_at) }`;

		/* Celular/tablet em pé: o cartão escolhido abre por dentro. */
		if (!is_wide && is_selected && !is_past) {
			return (
				<article key={session.id} className={cn(SURFACE, 'flex flex-col gap-4 rounded-3xl p-5')}>
					<div className='flex items-start gap-3'>
						<span className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary'><Bot className='size-5' /></span>
						<span className='flex min-w-0 flex-1 flex-col'>
							<span className='truncate text-lg font-bold'>{session.name}</span>
							<span className='truncate text-[13px] text-muted-foreground'>{ClaudeSessionUtils.scopeLabel(session.scope)}{session.client_name ? ` · ${ session.client_name }` : ''}</span>
						</span>
						{sessionStatusBadge(session)}
					</div>
					{meta(session)}
					<div className='border-t border-border pt-3'><ActivityList session={session} compact /></div>
					{revokeButton(session, 'h-11 self-end')}
				</article>
			);
		}

		return (
			<button
				key={session.id}
				type='button'
				onClick={() => setSelectedId(session.id)}
				className={cn(
					SURFACE,
					'pressable flex w-full flex-col gap-3 rounded-3xl p-4 text-left transition-[border-color,box-shadow]',
					is_past && 'border-dashed bg-transparent shadow-none dark:bg-transparent',
					is_wide && is_selected && 'border-primary/70 ring-1 ring-primary/40'
				)}
			>
				<span className='flex items-start gap-3'>
					<span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary', is_past && 'opacity-60')}><Bot className='size-[18px]' /></span>
					<span className='flex min-w-0 flex-1 flex-col'>
						<span className={cn('truncate font-bold', is_past && 'text-muted-foreground')}>{session.name}</span>
						<span className='truncate text-xs text-muted-foreground'>{ClaudeSessionUtils.scopeLabel(session.scope)}{session.client_name ? ` · ${ session.client_name }` : ''}</span>
					</span>
				</span>
				<span className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
					{footer}
					{sessionStatusBadge(session)}
				</span>
			</button>
		);
	};

	return (
		<div className='flex flex-col gap-4'>
			<section className={cn(SURFACE, 'flex flex-col gap-3 rounded-3xl p-5 xl:flex-row xl:items-center xl:gap-6')}>
				<div className='flex flex-1 flex-col gap-1'>
					<h3 className='text-lg font-bold max-md:hidden'>Conexões com o Claude</h3>
					<p className='text-sm text-muted-foreground'>
						No Claude, vá em <strong className='font-semibold text-foreground'>Configurações → Conectores → Adicionar conector personalizado</strong> e
						cole este endereço. Você escolhe o acesso e a validade (30, 90 ou 365 dias) ao autorizar.
					</p>
				</div>
				{isLoading
					? <Skeleton className='h-12 w-full rounded-2xl xl:w-[360px]' />
					: (
						<div className='flex items-center gap-2'>
							<code className='min-w-0 flex-1 truncate rounded-2xl bg-secondary px-4 py-3 font-mono text-sm xl:w-[260px] xl:flex-none'>{mcp_url}</code>
							<Button type='button' variant='outline' onClick={handleCopy} aria-label='Copiar endereço' className='h-12 gap-2 px-4 max-md:w-12 max-md:px-0'>
								<Copy className='size-4' />
								<span className='max-md:hidden'>Copiar</span>
							</Button>
						</div>
					)}
			</section>

			{isLoading && <Skeleton className='h-40 w-full rounded-3xl' />}

			{!isLoading && sessions.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center'>
					<Bot className='size-9 text-muted-foreground' />
					<span className='font-semibold'>Nenhuma conexão com o Claude ainda</span>
					<span className='text-sm text-muted-foreground'>Adicione o endereço acima como conector no Claude e autorize.</span>
				</div>
			)}

			{!isLoading && sessions.length > 0 && (
				<div className='grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start'>
					<div className='flex min-w-0 flex-col gap-3'>
						{current_sessions.length > 0 && (
							<>
								<span className='px-1 text-xs font-semibold text-muted-foreground'>Conexões atuais · {current_sessions.length}</span>
								{current_sessions.map(sessionCard)}
							</>
						)}
						{past_sessions.length > 0 && (is_wide || show_past) && (
							<>
								<span className='px-1 pt-2 text-xs font-semibold text-muted-foreground'>Revogadas e expiradas</span>
								{past_sessions.map(sessionCard)}
							</>
						)}
						{past_sessions.length > 0 && !is_wide && !show_past && (
							<button type='button' onClick={() => setShowPast(true)} className='pressable flex items-center gap-3 rounded-3xl border border-dashed border-border p-4 text-left'>
								<span className='flex min-w-0 flex-1 flex-col'>
									<span className='font-semibold text-muted-foreground'>Revogadas e expiradas · {past_sessions.length}</span>
									<span className='truncate text-xs text-muted-foreground'>{past_sessions.map((session) => session.name).join(' · ')}</span>
								</span>
								<ChevronRight className='size-4 text-muted-foreground' />
							</button>
						)}
					</div>

					{is_wide && selected && (
						<section className={cn(SURFACE, 'flex min-w-0 flex-col gap-4 rounded-3xl p-5')}>
							<div className='flex items-start justify-between gap-3'>
								<div className='flex min-w-0 flex-col gap-0.5'>
									<h3 className='truncate text-lg font-bold'>Atividade · {selected.name}</h3>
									<p className='text-sm text-muted-foreground'>O que o Claude consultou e alterou, da mais recente para a mais antiga.</p>
								</div>
								{revokeButton(selected)}
							</div>
							{meta(selected)}
							<ActivityList key={selected.id} session={selected} />
						</section>
					)}
				</div>
			)}

			<AlertDialog open={Boolean(revoking_session)} onOpenChange={(next) => !next && setRevokingSession(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Revogar conexão</AlertDialogTitle>
						<AlertDialogDescription>
							O Claude perde o acesso à sua conta por "{revoking_session?.name}" na hora. Para usar de novo, será preciso
							autorizar outra vez no Claude.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={is_revoke_pending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmRevoke} disabled={is_revoke_pending}>Revogar</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default ClaudeConnections;
