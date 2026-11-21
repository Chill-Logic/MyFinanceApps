import { ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

interface ISwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
	checked: boolean;
	onCheckedChange: (checked: boolean)=> void;
}

/* Switch simples (role="switch") no visual do shadcn, sem dependência do @radix-ui/react-switch. */
const Switch = forwardRef<HTMLButtonElement, ISwitchProps>(({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
	<button
		ref={ref}
		type='button'
		role='switch'
		aria-checked={checked}
		disabled={disabled}
		onClick={() => onCheckedChange(!checked)}
		className={cn(
			'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
			checked ? 'bg-primary' : 'bg-accent',
			className,
		)}
		{...props}
	>
		<span
			className={cn(
				'pointer-events-none block h-6 w-6 rounded-full shadow-md ring-0 transition-transform',
				checked ? 'translate-x-5 bg-navy' : 'translate-x-0 bg-card',
			)}
		/>
	</button>
));
Switch.displayName = 'Switch';

export default Switch;
