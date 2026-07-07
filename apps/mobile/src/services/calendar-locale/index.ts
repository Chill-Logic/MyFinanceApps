import { LocaleConfig } from 'react-native-calendars';

/**
 * Efeito colateral de módulo — precisa rodar uma única vez antes de qualquer <Calendar/> ser
 * montado, por isso é importado direto no App.tsx (topo da árvore), não dentro do
 * TransactionFormModal (que pode montar/desmontar várias vezes).
 */
LocaleConfig.locales['pt-br'] = {
	monthNames: [
		'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
		'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
	],
	monthNamesShort: [ 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez' ],
	dayNames: [ 'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado' ],
	dayNamesShort: [ 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb' ],
	today: 'Hoje',
};

LocaleConfig.defaultLocale = 'pt-br';
