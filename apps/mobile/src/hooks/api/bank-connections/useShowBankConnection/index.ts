import { BankConnectionUtils, QUERY_KEYS, showBankConnection, TBankConnection } from '@myfinance/shared';
import { useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '../../useAxiosInstance';

export const BANK_REFRESH_POLL_INTERVAL = 3000;

type TUseShowBankConnectionProps = {
	id?: string | null;
	enabled?: boolean;
	/* Ativa o polling enquanto a Pluggy está buscando no banco (`UPDATING`/`WAITING_USER_INPUT`). */
	poll?: boolean;
	/* Parte da chave: separa uma rodada de "Atualizar agora" da anterior, pra não reaproveitar um status velho do cache. */
	nonce?: number;
	initialData?: TBankConnection;
};

export const useShowBankConnection = (props: TUseShowBankConnectionProps) => {
	const { id, enabled = true, poll = false, nonce, initialData } = props;

	return useQuery({
		queryKey: [ QUERY_KEYS.bank_connection.get_one, id, nonce ],
		queryFn: async() => {
			const axios = await getAxiosInstance();
			return showBankConnection(axios, id!);
		},
		enabled: enabled && Boolean(id),
		initialData,
		initialDataUpdatedAt: 0,
		refetchInterval: (query) => (poll && BankConnectionUtils.isUpdating(query.state.data?.status) ? BANK_REFRESH_POLL_INTERVAL : false),
	});
};
