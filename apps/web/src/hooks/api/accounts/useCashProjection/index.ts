import { getCashProjection, QUERY_KEYS, type TCashProjectionParams } from '@myfinance/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getAxiosInstance } from '@/hooks/api/useAxiosInstance';

type TUseCashProjectionProps = {
	enabled?: boolean;
	params: TCashProjectionParams;
};

/*
 * Saldo projetado das contas (tela de Contas), do endpoint `GET /accounts/projection` (`TCashProjection`).
 * O backend conta também pendências de conta atrasadas e faturas vencidas e não pagas de QUALQUER mês
 * anterior (entram hoje) — a estimativa antiga do front (`estimateCashProjection`) só olhava o mês corrente.
 */
export const useCashProjection = ({ enabled = true, params }: TUseCashProjectionProps) => useQuery({
	queryKey: [ QUERY_KEYS.account.get_projection, params.wallet_id, params.days ],
	queryFn: async() => {
		const axios = getAxiosInstance();
		return getCashProjection(axios, params);
	},
	placeholderData: keepPreviousData,
	enabled: enabled && Boolean(params.wallet_id),
});

export default useCashProjection;
