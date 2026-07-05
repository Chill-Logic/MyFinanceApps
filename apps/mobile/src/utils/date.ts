import moment from 'moment';

const EXPECTED_FORMATS = [
	moment.ISO_8601,
	'YYYY-MM-DD',
	'YYYY/MM/DD',
	'DD-MM-YYYY',
	'DD/MM/YYYY',
];

const isDateValid = (date: string | Date) => {
	if(!date) {
		return undefined;
	}

	const moment_date = moment(date, EXPECTED_FORMATS, true);
	if(!moment_date.isValid()) {
		console.error('Invalid date format', date);
		return undefined;
	}
	return moment_date;
};

export const DateUtils = {
	formatDate: (date: string | Date) => {
		const moment_date = isDateValid(date);
		if (!moment_date) {
			return '';
		}

		return moment_date.format('DD/MM/YYYY');
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
		const moment_date = isDateValid(date);
		if (!moment_date) {
			return '';
		}

		return moment_date.format('DD/MM/YYYY HH:mm:ss');
	},
	formatDateToISO: (date: string | Date, omitTime: boolean = false) => {
		const moment_date = isDateValid(date);
		if (!moment_date) {
			return '';
		}

		return omitTime ? moment_date.toISOString().split('T')[0] : moment_date.toISOString();
	},
	formateTo: (date: string | Date, format: string) => {
		const moment_date = isDateValid(date);
		if (!moment_date) {
			return '';
		}

		return moment_date.format(format);
	},
};
