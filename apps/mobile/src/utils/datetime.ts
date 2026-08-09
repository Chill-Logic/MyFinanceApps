/*
 * Helpers de data + horário compartilhados pelos modais que editam data/hora no mobile
 * (TransactionFormModal, PayInvoiceModal). Como o Expo Go não tem datetimepicker nativo, a DATA vem do
 * `react-native-calendars` (string "dd/MM/yyyy") e o HORÁRIO de um input mascarado "HH:MM"; estas
 * funções convertem entre esses formatos de tela e a string ISO enviada pro backend.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

/*
 * Conversão puramente textual (sem passar por Date) na parte de DATA de propósito — evita qualquer
 * risco de o fuso horário deslocar o dia enquanto o calendário só lida com a data.
 */
export const toISODate = (display_date: string) => {
	const [ day, month, year ] = display_date.split('/');
	if (!day || !month || !year) return '';
	return `${ year }-${ month }-${ day }`;
};

export const toDisplayDate = (iso_date: string) => {
	const [ year, month, day ] = iso_date.split('-');
	return `${ day }/${ month }/${ year }`;
};

/* Máscara de horário "HH:MM" — mantém só dígitos e insere os dois-pontos depois de 2 casas. */
export const formatTimeInput = (text: string) => {
	const numbers = text.replace(/\D/g, '').slice(0, 4);
	if (numbers.length <= 2) return numbers;
	return `${ numbers.slice(0, 2) }:${ numbers.slice(2) }`;
};

/* Valida "HH:MM" (00-23 / 00-59). */
export const isValidTime = (time: string) => {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) return false;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

/*
 * Combina "dd/MM/yyyy" + "HH:MM" numa string ISO. Constrói um Date no fuso LOCAL e chama
 * `toISOString()` — mesmo caminho do web (`DateTimeField`), pra o instante enviado bater com o horário
 * escolhido na tela (aqui, ao contrário da parte só-data, o horário importa).
 */
export const combineToISO = (display_date: string, time: string) => {
	const [ day, month, year ] = display_date.split('/').map(Number);
	if (!day || !month || !year) return '';
	const [ hours, minutes ] = time.split(':').map(Number);
	const date = new Date(year, month - 1, day, Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
	return date.toISOString();
};

/* Quebra uma string ISO nas partes de tela (data + horário), no fuso local — igual o web faz com `new Date`. */
export const isoToParts = (iso: string) => {
	const date = new Date(iso);
	return {
		date: `${ pad2(date.getDate()) }/${ pad2(date.getMonth() + 1) }/${ date.getFullYear() }`,
		time: `${ pad2(date.getHours()) }:${ pad2(date.getMinutes()) }`,
	};
};

/* Data/horário atuais nas partes de tela — usado pelos botões "Marcar como pago". */
export const nowParts = () => isoToParts(new Date().toISOString());
