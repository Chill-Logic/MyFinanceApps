import { type TAcceptedPolicies, type TPolicyKind } from '@myfinance/shared';

import { useVersion } from '@/hooks/api/core/useVersion';

import { PRIVACY_POLICY, TERMS_OF_USE } from '@/util/legalDocuments';

/*
 * Versão vigente de cada documento legal. Quem manda é o backend (`policies` do `GET /core/version`, issue #26): é
 * contra ela que ele valida o aceite. Sem a informação (backend antigo, sem rede), vale a versão do texto que o app
 * mostra — a mesma que está em `util/legalDocuments.ts`.
 */
export const usePolicyVersions = (): Record<TPolicyKind, string> & { accepted: TAcceptedPolicies } => {
	const { data } = useVersion();
	const versions = {
		privacy: data?.policies?.privacy ?? PRIVACY_POLICY.version,
		terms: data?.policies?.terms ?? TERMS_OF_USE.version,
	};
	return { ...versions, accepted: versions };
};

export default usePolicyVersions;
