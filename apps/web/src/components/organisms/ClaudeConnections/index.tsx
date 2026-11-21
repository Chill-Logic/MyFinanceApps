import { useState } from 'react';

import { ClaudeSessionUtils, DateUtils, getApiErrorMessage, type TClaudeSession } from '@myfinance/shared';
import { Activity, Bot, Copy, ShieldOff } from 'lucide-react';

import { useIndexClaudeSessions } from '@/hooks/api/claude-sessions/useIndexClaudeSessions';
import { useIndexClaudeToolCalls } from '@/hooks/api/claude-sessions/useIndexClaudeToolCalls';
import { useRevokeClaudeSession } from '@/hooks/api/claude-sessions/useRevokeClaudeSession';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const TONE_CLASS = {
	success: 'text-success',
	warning: 'text-warning',
	error: 'text-destructive',
	neutral: 'text-muted-foreground',
} as const;

const ToolCallsDialog = ({ session, onClose }: { session: TClaudeSession | null; onClose: ()=> void }) => {
	const { data, isLoading } = useIndexClaudeToolCalls({ session_id: session?.id });
	const tool_calls = data?.data || [];

	return (
		<Dialog open={Boolean(session)} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className='max-h-[85vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>Atividade {session ? `· ${ session.name }` : ''}</DialogTitle>
					<DialogDescription>O que o Claude consultou e alterou por esta conexão, da mais recente para a mais antiga.</DialogDescription>
				</DialogHeader>

				{isLoading && (
					<div className='flex flex-col gap-2'>
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton key={index} className='h-12 w-full' />
						))}
					</div>
				)}

				{!isLoading && tool_calls.length === 0 && (
					<div className='flex flex-col items-center gap-2 py-8 text-center'>
						<Activity className='h-10 w-10 text-muted-foreground' />
						<span className='font-medium'>Nenhuma atividade ainda</span>
					</div>
				)}

				{!isLoading && tool_calls.length > 0 && (
					<ul className='flex flex-col gap-2'>
						{tool_calls.map((call) => {
							const status = ClaudeSessionUtils.toolCallStatusLabel(call.status);

							return (
								<li key={call.id} className='flex flex-col gap-1 rounded-lg border border-border p-3'>
									<div className='flex items-start justify-between gap-3'>
										<div className='min-w-0'>
											<p className='truncate text-sm font-medium text-foreground'>{call.tool_title}</p>
											<p className='text-xs text-muted-foreground'>
												{DateUtils.formateTo(call.created_at, 'dd/MM/yyyy \'às\' HH:mm:ss')}
												{' · '}
												{call.kind === 'write' ? 'Escrita' : 'Leitura'}
											</p>
										</div>
										<span className={cn('shrink-0 text-xs font-semibold', TONE_CLASS[status.tone])}>{status.label}</span>
									</div>
									{call.error_message && <p className='text-xs text-muted-foreground'>{call.error_message}</p>}
								</li>
							);
						})}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
};

/**
 * Conexões do Claude (conector MCP) do usuário: como conectar (URL do MCP), lista das conexões com
 * status/acesso/último uso, a atividade de cada uma (auditoria das ferramentas) e revogar. Usado na
 * seção "Conexões com o Claude" das Configurações.
 */
const ClaudeConnections = () => {
	const { toast } = useToast();
	const { data, isLoading } = useIndexClaudeSessions();
	const { mutate: revokeMutation, isPending: is_revoke_pending } = useRevokeClaudeSession();

	const [ revoking_session, setRevokingSession ] = useState<TClaudeSession | null>(null);
	const [ activity_session, setActivitySession ] = useState<TClaudeSession | null>(null);

	const sessions = data?.data || [];
	const current_sessions = sessions.filter(ClaudeSessionUtils.isRevocable);
	const past_sessions = sessions.filter((session) => !ClaudeSessionUtils.isRevocable(session));
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

	const renderSession = (session: TClaudeSession) => {
		const status = ClaudeSessionUtils.statusLabel(session.status);
		const is_revocable = ClaudeSessionUtils.isRevocable(session);

		return (
			<li key={session.id} className={cn('flex flex-col gap-3 rounded-lg border border-card bg-card p-4', !is_revocable && 'opacity-70')}>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='truncate font-medium text-foreground'>{session.name}</p>
						<p className='truncate text-xs text-muted-foreground'>
							{ClaudeSessionUtils.scopeLabel(session.scope)}
							{session.client_name ? ` · ${ session.client_name }` : ''}
						</p>
					</div>
					<span className={cn('shrink-0 text-xs font-semibold', TONE_CLASS[status.tone])}>{status.label}</span>
				</div>

				<div className='flex flex-col gap-0.5 text-xs text-muted-foreground'>
					<span>{ClaudeSessionUtils.lastUsedLabel(session)}</span>
					<span>{ClaudeSessionUtils.expirationLabel(session)}</span>
					<span>Autorizada em {DateUtils.formatDate(session.created_at)}</span>
				</div>

				<div className='flex flex-wrap justify-end gap-2'>
					<Button type='button' size='sm' variant='secondary' className='gap-2' onClick={() => setActivitySession(session)}>
						<Activity className='h-4 w-4' />
						Atividade
					</Button>
					{is_revocable && (
						<Button type='button' size='sm' variant='destructive' className='gap-2' onClick={() => setRevokingSession(session)}>
							<ShieldOff className='h-4 w-4' />
							Revogar
						</Button>
					)}
				</div>
			</li>
		);
	};

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-3 rounded-lg border border-card bg-card p-4'>
				<p className='text-sm text-foreground'>
					Conecte o Claude à sua conta para consultar saldos, extratos e faturas — e, se você permitir, lançar e editar
					transações — conversando. No Claude, vá em <strong>Configurações → Conectores → Adicionar conector
					personalizado</strong> e cole o endereço abaixo. Você escolhe o nível de acesso e a validade ao autorizar.
				</p>
				{isLoading ? (
					<Skeleton className='h-10 w-full' />
				) : (
					<div className='flex items-center gap-2'>
						<code className='min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-foreground'>{mcp_url}</code>
						<Button type='button' size='icon' variant='outline' aria-label='Copiar endereço' title='Copiar' onClick={handleCopy}>
							<Copy className='h-4 w-4' />
						</Button>
					</div>
				)}
			</div>

			{isLoading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-28 w-full' />
					))}
				</div>
			)}

			{!isLoading && sessions.length === 0 && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center'>
					<Bot className='h-10 w-10 text-muted-foreground' />
					<p className='text-sm text-muted-foreground'>Nenhuma conexão com o Claude ainda</p>
				</div>
			)}

			{!isLoading && current_sessions.length > 0 && (
				<ul className='flex flex-col gap-2'>{current_sessions.map(renderSession)}</ul>
			)}

			{!isLoading && past_sessions.length > 0 && (
				<div className='flex flex-col gap-2'>
					<p className='text-xs font-semibold uppercase text-muted-foreground'>Revogadas e expiradas</p>
					<ul className='flex flex-col gap-2'>{past_sessions.map(renderSession)}</ul>
				</div>
			)}

			<ToolCallsDialog session={activity_session} onClose={() => setActivitySession(null)} />

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
