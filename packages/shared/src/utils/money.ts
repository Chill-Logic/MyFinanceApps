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
};
