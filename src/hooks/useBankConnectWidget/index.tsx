import { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';

import { BankConnectionUtils, getApiErrorMessage, type TBankConnection, type TBankImport } from '@myfinance/shared';

import { useConnectBankToken } from '@/hooks/api/bank-connections/useConnectBankToken';
import { useCreateBankConnection } from '@/hooks/api/bank-connections/useCreateBankConnection';
import { useSyncBankConnection } from '@/hooks/api/bank-connections/useSyncBankConnection';
import useToast from '@/hooks/useToast';

import { useTheme } from '@/context/theme';

/* Widget aberto: token novo a cada abertura; `connection` presente = modo atualização (reconectar). */
type TWidgetState = {
	token: string;
	connection: TBankConnection | null;
};

type TProps = {
	wallet_id?: string;
	/* Conexão nova salva (ex.: abrir "Contas do banco" pra escolher destinos). */
	onCreated?: (connection: TBankConnection)=> void;
};

/*
 * Widget da Pluggy (conectar banco novo ou reconectar um existente), usado na aba Bancos e na tela "Contas do
 * banco". Depois de reconectar, a Pluggy já buscou no banco: só roda a rotina (`sync`) pra trazer o que chegou.
 * Renderize `element` em algum lugar da tela.
 */
export const useBankConnectWidget = ({ wallet_id, onCreated }: TProps) => {
	const { theme } = useTheme();
	const { toast } = useToast();
	const [ widget, setWidget ] = useState<TWidgetState | null>(null);
	const [ syncing_id, setSyncingId ] = useState<string | null>(null);

	const { mutate: connectTokenMutation, isPending: is_token_pending } = useConnectBankToken();
	const { mutate: createConnectionMutation, isPending: is_create_pending } = useCreateBankConnection();
	const { mutate: syncConnectionMutation } = useSyncBankConnection();

	const notifyImports = (imports: TBankImport[]) => toast.success(imports.length > 0
		? `Atualizado: ${ BankConnectionUtils.importSummaryMessage(imports) }`
		: 'Atualizado: nada novo para importar');

	const open = (connection: TBankConnection | null = null) => {
		connectTokenMutation({
			body: connection ? { bank_connection_id: connection.id } : {},
			onSuccess: ({ access_token }) => setWidget({ token: access_token, connection }),
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao iniciar a conexão com o banco')),
		});
	};

	const sync = (connection: TBankConnection) => {
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

	const handleSuccess = (item_id: string) => {
		const updated_connection = widget?.connection;
		setWidget(null);

		if (updated_connection) {
			sync(updated_connection);
			return;
		}

		if (!wallet_id) return;

		createConnectionMutation({
			body: { wallet_id, item_id },
			onSuccess: ({ data }) => {
				toast.success('Banco conectado. Escolha o que importar.');
				onCreated?.(data);
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao salvar a conexão bancária')),
		});
	};

	const element = widget && (
		<PluggyConnect
			connectToken={widget.token}
			updateItem={widget.connection?.external_id}
			includeSandbox
			language='pt'
			theme={theme}
			onSuccess={({ item }) => handleSuccess(item.id)}
			onError={({ message }) => {
				toast.error(message || 'Não foi possível conectar ao banco');
			}}
			onClose={() => setWidget(null)}
		/>
	);

	return {
		open,
		element,
		notifyImports,
		/* Pedindo o token (antes do widget abrir). */
		is_opening: is_token_pending && !widget,
		is_token_pending,
		is_creating: is_create_pending,
		syncing_id,
	};
};

export default useBankConnectWidget;
