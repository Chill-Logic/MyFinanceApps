import { useEffect, useRef, useState } from 'react';

import { BankConnectionUtils, type TBankConnection, type TSyncBankConnectionResponse } from '@myfinance/shared';

import { useRefreshBankConnection } from '@/hooks/api/bank-connections/useRefreshBankConnection';
import { useShowBankConnection } from '@/hooks/api/bank-connections/useShowBankConnection';
import { useSyncBankConnection } from '@/hooks/api/bank-connections/useSyncBankConnection';

/* Depois disso desistimos de esperar a Pluggy (ex.: banco pedindo MFA e ninguém respondendo). */
const REFRESH_TIMEOUT_MS = 3 * 60 * 1000;

type TRun = {
	connection: TBankConnection;
	started_at: number;
};

type TProps = {
	onFinished: (result: TSyncBankConnectionResponse)=> void;
	onFailed: (error?: unknown, message?: string)=> void;
};

/*
 * "Atualizar agora": pede à Pluggy pra buscar no banco (`refresh`, assíncrono), faz polling no `show`
 * enquanto a conexão está `UPDATING`/`WAITING_USER_INPUT` e, quando sai disso, roda a rotina (`sync`)
 * pra trazer o que chegou. Uma conexão por vez.
 */
export const useBankConnectionRefresh = ({ onFinished, onFailed }: TProps) => {
	const [ run, setRun ] = useState<TRun | null>(null);
	const [ requesting_id, setRequestingId ] = useState<string | null>(null);
	const syncing = useRef(false);
	const callbacks = useRef({ onFinished, onFailed });
	callbacks.current = { onFinished, onFailed };

	const { mutate: refreshMutation } = useRefreshBankConnection();
	const { mutate: syncMutation } = useSyncBankConnection();
	const { data: polled_connection } = useShowBankConnection({
		id: run?.connection.id,
		enabled: Boolean(run),
		poll: true,
		nonce: run?.started_at,
		initialData: run?.connection,
	});

	useEffect(() => {
		if (!run) return undefined;

		const timeout = setTimeout(() => {
			setRun(null);
			callbacks.current.onFailed(undefined, 'O banco está demorando para responder. Tente de novo mais tarde.');
		}, REFRESH_TIMEOUT_MS);

		return () => clearTimeout(timeout);
	}, [ run ]);

	useEffect(() => {
		if (!run || !polled_connection || syncing.current) return;
		if (BankConnectionUtils.isUpdating(polled_connection.status)) return;

		syncing.current = true;
		syncMutation({
			id: run.connection.id,
			onSuccess: (result) => {
				syncing.current = false;
				setRun(null);
				callbacks.current.onFinished(result);
			},
			onError: (error) => {
				syncing.current = false;
				setRun(null);
				callbacks.current.onFailed(error);
			},
		});
	}, [ run, polled_connection, syncMutation ]);

	const refresh = (connection: TBankConnection) => {
		if (run || requesting_id) return;

		setRequestingId(connection.id);
		refreshMutation({
			id: connection.id,
			onSuccess: (updated) => {
				setRequestingId(null);
				setRun({ connection: updated, started_at: Date.now() });
			},
			onError: (error) => {
				setRequestingId(null);
				callbacks.current.onFailed(error);
			},
		});
	};

	return {
		refresh,
		refreshing_id: requesting_id || run?.connection.id || null,
	};
};

export default useBankConnectionRefresh;
