export const MoneyUtils = {
	formatMoney: (value?: string | number): string => {
		const numericValue = String(value ?? 0).replace(/\D/g, '');

		const amount = Number(numericValue) / 100;

		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: 'BRL',
		}).format(amount);
	},
	unformatMoney: (formattedValue?: string | number): string => {
		return String(formattedValue ?? 0).replace(/\D/g, '');
	},
	/*
	 * `formatMoney` sempre devolve SEM sinal (o `replace(/\D/g)` remove o "-"). Pra valores com sinal —
	 * saldos/subtotais que podem ser negativos (settled/projected/net) — use este, que prefixa "-" quando
	 * negativo. Não prefixa "+" em positivos (num saldo isso não é natural). Transações individuais
	 * continuam prefixando +/- à mão pelo `kind`, não por aqui.
	 */
	formatSignedMoney: (value?: number): string => {
		const numeric = Number(value ?? 0);
		return `${ numeric < 0 ? '-' : '' }${ MoneyUtils.formatMoney(numeric) }`;
	},
};
