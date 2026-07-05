import { endOfMonth, format, isValid, parse, parseISO } from 'date-fns';

const EXPECTED_FORMATS = [ 'yyyy-MM-dd', 'yyyy/MM/dd', 'dd-MM-yyyy', 'dd/MM/yyyy' ];

const parseDate = (date: string | Date): Date | undefined => {
	if (!date) {
		return undefined;
	}

	if (date instanceof Date) {
		return isValid(date) ? date : undefined;
	}

	const iso_date = parseISO(date);
	if (isValid(iso_date)) {
		return iso_date;
	}

	for (const date_format of EXPECTED_FORMATS) {
		const parsed_date = parse(date, date_format, new Date());
		if (isValid(parsed_date)) {
			return parsed_date;
		}
	}

	console.error('Invalid date format', date);
	return undefined;
};

export const DateUtils = {
	formatDate: (date: string | Date) => {
		const parsed_date = parseDate(date);
		if (!parsed_date) {
			return '';
		}

		return format(parsed_date, 'dd/MM/yyyy');
	},
	formatDateInput: (text: string) => {
		const numbers = text.replace(/\D/g, '');

		if (numbers.length <= 2) {
			return numbers;
		} else if (numbers.length <= 4) {
			return `${ numbers.slice(0, 2) }/${ numbers.slice(2) }`;
		} else if (numbers.length <= 8) {
			return `${ numbers.slice(0, 2) }/${ numbers.slice(2, 4) }/${ numbers.slice(4, 8) }`;
		} else {
			return `${ numbers.slice(0, 2) }/${ numbers.slice(2, 4) }/${ numbers.slice(4, 8) }`;
		}
	},
	formatDateTime: (date: string | Date) => {
		const parsed_date = parseDate(date);
		if (!parsed_date) {
			return '';
		}

		return format(parsed_date, 'dd/MM/yyyy HH:mm:ss');
	},
	formatDateToISO: (date: string | Date, omitTime: boolean = false) => {
		const parsed_date = parseDate(date);
		if (!parsed_date) {
			return '';
		}

		return omitTime ? parsed_date.toISOString().split('T')[0] : parsed_date.toISOString();
	},
	formateTo: (date: string | Date, date_format: string) => {
		const parsed_date = parseDate(date);
		if (!parsed_date) {
			return '';
		}

		return format(parsed_date, date_format);
	},
	getMonthRange: (year: number, month: number) => {
		const start = new Date(year, month, 1);
		const end = endOfMonth(start);

		return {
			start_date: format(start, 'yyyy-MM-dd'),
			end_date: format(end, 'yyyy-MM-dd'),
		};
	},
};
