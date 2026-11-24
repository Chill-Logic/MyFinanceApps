import { InputHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

import { FIELD_SURFACE } from '@/components/ui/field';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => {
	return (
		<input
			type={type}
			className={cn(
				'flex w-full',
				FIELD_SURFACE,
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
Input.displayName = 'Input';

export default Input;
