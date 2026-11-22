import { estimateCashProjection, QUERY_KEYS, type TCashProjectionParams } from '@myfinance/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseCashProjectionProps = {
	enabled?: boolean;
	params: TCashProjectionParams;
};

/*
 * Saldo projetado das contas (tela de Contas), já no formato do endpoint `GET /accounts/projection`
 * (`TCashProjection`). Esse endpoint ainda não existe: por enquanto o `queryFn` usa `estimateCashProjection`,
 * que monta a mesma resposta a partir dos endpoints de hoje. Quando o backend implementar, troque por
 * `getCashProjection(axios, params)` — a tela não muda.
 */
export const useCashProjection = ({ enabled = true, params }: TUseCashProjectionProps) => useQuery({
	queryKey: [ QUERY_KEYS.account.get_projection, params.wallet_id, params.days ],
	queryFn: async() => {
		const axios = getAxiosInstance();
		return estimateCashProjection(axios, params);
	},
	placeholderData: keepPreviousData,
	enabled: enabled && Boolean(params.wallet_id),
});

export default useCashProjection;
