/*
 * Endereços em português, código em inglês: o que aparece na URL (`?secao=`, `?aba=`) é o nome em português, e as
 * telas seguem usando os identificadores em inglês por dentro. Estes mapas fazem a tradução nos dois sentidos e
 * também atendem os redirecionamentos dos endereços antigos (`router/legacyRedirects`).
 */

/* Seções das Configurações (`/configuracoes?secao=`). */
export const SECTION_SLUGS = {
	account: 'conta',
	account_info: 'dados-pessoais',
	password: 'senha',
	appearance: 'aparencia',
	security: 'seguranca',
	main_wallet: 'carteira-principal',
	claude: 'claude',
	bank: 'integracao-bancaria',
	about: 'sobre',
} as const;

/* Abas de Contas & Cartões (`/contas?aba=`). */
export const TAB_SLUGS = {
	accounts: 'contas',
	cards: 'cartoes',
	recurrences: 'recorrencias',
	connections: 'bancos',
} as const;
