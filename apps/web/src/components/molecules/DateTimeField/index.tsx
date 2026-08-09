import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import Button from '@/components/atoms/Button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface IProps {
	value: Date;
	onChange: (next: Date)=> void;
	disabled?: boolean;
}

/* Troca só a parte de DATA de `base`, preservando o horário já escolhido. */
export const withDatePart = (base: Date, picked: Date): Date => {
	const next = new Date(picked);
	next.setHours(base.getHours(), base.getMinutes(), 0, 0);
	return next;
};

/* Troca só o HORÁRIO de `base` a partir de um "HH:mm" (input nativo de time). */
export const withTimePart = (base: Date, hhmm: string): Date => {
	const [ hours, minutes ] = hhmm.split(':').map(Number);
	const next = new Date(base);
	next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
	return next;
};

/* Seletor de data (calendário) + horário (input nativo de time) num controle só. */
const DateTimeField = ({ value, onChange, disabled }: IProps) => (
	<div className='flex gap-2'>
		<Popover>
			<PopoverTrigger asChild>
				<Button type='button' variant='outline' disabled={disabled} className='flex-1 justify-start gap-2 font-normal'>
					<CalendarIcon className='h-4 w-4' />
					{format(value, 'dd/MM/yyyy')}
				</Button>
			</PopoverTrigger>
			<PopoverContent className='w-auto p-0' align='start'>
				<Calendar mode='single' selected={value} onSelect={(picked) => picked && onChange(withDatePart(value, picked))} />
			</PopoverContent>
		</Popover>
		<input
			type='time'
			value={format(value, 'HH:mm')}
			disabled={disabled}
			onChange={(e) => onChange(withTimePart(value, e.target.value))}
			className='h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
		/>
	</div>
);

export default DateTimeField;
