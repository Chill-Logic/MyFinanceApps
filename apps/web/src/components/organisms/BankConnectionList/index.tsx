import { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import { useNavigate } from 'react-router-dom';

import { BankConnectionUtils, getApiErrorMessage, type TBankConnection, type TBankImport } from '@myfinance/shared';
import { ChevronRight, Landmark, Link2, ListChecks, MoreVertical, Plus, RefreshCw, Unplug } from 'lucide-react';

import { useConnectBankToken } from '@/hooks/api/bank-connections/useConnectBankToken';
import { useCreateBankConnection } from '@/hooks/api/bank-connections/useCreateBankConnection';
import { useDeleteBankConnection } from '@/hooks/api/bank-connections/useDeleteBankConnection';
import { useIndexBankConnections } from '@/hooks/api/bank-connections/useIndexBankConnections';
import { useSyncBankConnection } from '@/hooks/api/bank-connections/useSyncBankConnection';
import useBankConnectionRefresh from '@/hooks/useBankConnectionRefresh';
import useToast from '@/hooks/useToast';

import { useTheme } from '@/context/theme';
import { useWallet } from '@/context/wallet';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

/* Widget aberto: token novo a cada abertura; `connection` presente = modo atualização (reconectar). */
type TWidgetState = {
	token: string;
	connection: TBankConnection | null;
};

const TONE_CLASS = {
	success: 'text-feedback-success-default',
	warning: 'text-feedback-warning-default',
	error: 'text-destructive',
	neutral: 'text-muted-foreground',
} as const;

const primaryActionLabel = (is_busy: boolean, needs_reconnect: boolean) => {
	if (is_busy) return 'Atualizando…';
	return needs_reconnect ? 'Reconectar' : 'Atualizar agora';
};

const ConnectorLogo = ({ connection }: { connection: TBankConnection }) => {
	const [ failed, setFailed ] = useState(false);
	const brand_color = BankConnectionUtils.brandColor(connection);

	if (connection.connector_image_url && !failed) {
		return (
			<img
				src={connection.connector_image_url}
				alt={connection.connector_name || 'Instituição'}
				onError={() => setFailed(true)}
				className='h-10 w-10 shrink-0 rounded-full bg-white object-contain p-1'
			/>
		);
	}

	return (
		<div
			className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'
			style={brand_color ? { backgroundColor: brand_color, color: '#fff' } : undefined}
		>
			<Landmark className='h-5 w-5' />
		</div>
	);
};

const BankConnectionList = () => {
	const { user_wallet, is_loading: is_wallet_loading } = useWallet();
	const { theme } = useTheme();
	const { toast } = useToast();
	const navigate = useNavigate();

	const wallet_id = user_wallet.data?.id;
	const { data: connections_data, isLoading: is_connections_loading } = useIndexBankConnections({
		enabled: Boolean(wallet_id),
		params: { wallet_id: wallet_id || '' },
	});
	const { mutate: connectTokenMutation, isPending: is_token_pending } = useConnectBankToken();
	const { mutate: createConnectionMutation, isPending: is_create_pending } = useCreateBankConnection();
	const { mutate: syncConnectionMutation } = useSyncBankConnection();
	const { mutate: deleteConnectionMutation, isPending: is_delete_pending } = useDeleteBankConnection();

	const [ widget, setWidget ] = useState<TWidgetState | null>(null);
	const [ syncing_id, setSyncingId ] = useState<string | null>(null);
	const [ deleting_connection, setDeletingConnection ] = useState<TBankConnection | null>(null);

	const connections = connections_data?.data || [];
	const is_loading = is_wallet_loading || is_connections_loading;

	const notifyImports = (imports: TBankImport[]) => toast.success(imports.length > 0
		? `Atualizado: ${ BankConnectionUtils.importSummaryMessage(imports) }`
		: 'Atualizado: nada novo para importar');

	const { refresh, refreshing_id } = useBankConnectionRefresh({
		onFinished: ({ imports }) => notifyImports(imports),
		onFailed: (error, message) => toast.error(message || getApiErrorMessage(error, 'Erro ao atualizar a conexão')),
	});

	const openAccounts = (connection: Pick<TBankConnection, 'id'>) => navigate(`/accounts/banks/${ connection.id }`);

	const openWidget = (connection: TBankConnection | null = null) => {
		connectTokenMutation({
			body: connection ? { bank_connection_id: connection.id } : {},
			onSuccess: ({ access_token }) => setWidget({ token: access_token, connection }),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao iniciar a conexão com o banco')),
		});
	};

	/* Depois de reconectar, a Pluggy já buscou no banco: só roda a rotina pra trazer o que chegou. */
	const handleSync = (connection: TBankConnection) => {
		setSyncingId(connection.id);
		syncConnectionMutation({
			id: connection.id,
			onSuccess: ({ imports }) => {
				notifyImports(imports);
				setSyncingId(null);
			},
			onError: (error) => {
				toast.error(getApiErrorMessage(error, 'Erro ao sincronizar'));
				setSyncingId(null);
			},
		});
	};

	const handleWidgetSuccess = (item_id: string) => {
		const updated_connection = widget?.connection;
		setWidget(null);

		if (updated_connection) {
			handleSync(updated_connection);
			return;
		}

		if (!wallet_id) return;

		createConnectionMutation({
			body: { wallet_id, item_id },
			onSuccess: ({ data }) => {
				toast.success('Banco conectado. Escolha o que importar.');
				openAccounts(data);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao salvar a conexão bancária')),
		});
	};

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

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<p className='text-sm text-muted-foreground'>
					Conecte um banco e escolha, conta por conta, o que importar para esta carteira.
				</p>
				<Button
					type='button'
					onClick={() => openWidget()}
					disabled={!wallet_id || is_create_pending}
					isLoading={is_token_pending && !widget}
					className='shrink-0 gap-2 self-end sm:self-auto'
				>
					{!is_token_pending && <Plus className='h-4 w-4' />}
					Conectar banco
				</Button>
			</div>

			{is_create_pending && (
				<div className='flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground'>
					<RefreshCw className='h-4 w-4 animate-spin' />
					Salvando a conexão…
				</div>
			)}

			{is_loading && (
				<div className='flex flex-col gap-2'>
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className='h-16 w-full' />
					))}
				</div>
			)}

			{!is_loading && connections.length === 0 && !is_create_pending && (
				<div className='flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center'>
					<Link2 className='h-10 w-10 text-muted-foreground' />
					<div className='flex flex-col gap-1'>
						<span className='font-medium'>Nenhum banco conectado</span>
						<span className='text-sm text-muted-foreground'>Conecte um banco para importar contas, cartões e transações.</span>
					</div>
				</div>
			)}

			{!is_loading && connections.length > 0 && (
				<ul className='flex flex-col gap-2'>
					{connections.map((connection) => {
						const status = BankConnectionUtils.status(connection.status);
						const needs_reconnect = BankConnectionUtils.needsReconnect(connection.status);
						const is_busy = syncing_id === connection.id || refreshing_id === connection.id;

						return (
							<li key={connection.id} className='flex items-center gap-3 rounded-lg border border-card bg-card p-4'>
								<button
									type='button'
									onClick={() => openAccounts(connection)}
									className='flex min-w-0 flex-1 items-center gap-3 text-left'
									aria-label={`Contas do banco ${ connection.connector_name || '' }`}
								>
									<ConnectorLogo connection={connection} />

									<div className='min-w-0 flex-1'>
										<p className='truncate font-medium text-foreground'>{connection.connector_name || 'Banco'}</p>
										<p className='truncate text-xs text-muted-foreground'>
											<span className={cn('font-medium', TONE_CLASS[status.tone])}>{is_busy ? 'Atualizando…' : status.label}</span>
											{' · '}
											{BankConnectionUtils.lastSyncLabel(connection)}
										</p>
									</div>

									<ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
								</button>

								<Button
									type='button'
									variant={needs_reconnect ? 'default' : 'secondary'}
									size='sm'
									onClick={() => (needs_reconnect ? openWidget(connection) : refresh(connection))}
									disabled={is_busy || is_token_pending || (Boolean(refreshing_id) && !needs_reconnect)}
									className='hidden shrink-0 gap-2 sm:inline-flex'
								>
									<RefreshCw className={cn('h-4 w-4', is_busy && 'animate-spin')} />
									{primaryActionLabel(is_busy, needs_reconnect)}
								</Button>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button type='button' variant='ghost' size='icon' aria-label='Ações da conexão' className='shrink-0'>
											{is_busy ? <RefreshCw className='h-4 w-4 animate-spin' /> : <MoreVertical className='h-4 w-4' />}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align='end'>
										<DropdownMenuItem onClick={() => refresh(connection)} disabled={is_busy || Boolean(refreshing_id)}>
											<RefreshCw className='mr-2 h-4 w-4' />
											Atualizar agora
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => openAccounts(connection)}>
											<ListChecks className='mr-2 h-4 w-4' />
											Contas do banco
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => openWidget(connection)} disabled={is_token_pending}>
											<Link2 className='mr-2 h-4 w-4' />
											Reconectar
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => setDeletingConnection(connection)} className='text-destructive focus:text-destructive'>
											<Unplug className='mr-2 h-4 w-4' />
											Desconectar
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						);
					})}
				</ul>
			)}

			{widget && (
				<PluggyConnect
					connectToken={widget.token}
					updateItem={widget.connection?.external_id}
					includeSandbox
					language='pt'
					theme={theme}
					onSuccess={({ item }) => handleWidgetSuccess(item.id)}
					onError={({ message }) => {
						toast.error(message || 'Não foi possível conectar ao banco');
					}}
					onClose={() => setWidget(null)}
				/>
			)}

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
