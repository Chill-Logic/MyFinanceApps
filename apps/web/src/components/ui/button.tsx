import { ButtonHTMLAttributes, forwardRef } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Redesign 2026-11: botões em pílula (`rounded-full`), ação principal oliva com texto marinho,
 * secundários contornados. `navy` é o botão "de marca" (marinho fixo nos dois temas), usado em
 * seleção forte, como o tipo ativo (Saída/Entrada/Transferência) do formulário.
 */
export const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,border-color,opacity,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				navy: 'bg-navy text-sand-light hover:bg-navy-light',
				secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-accent',
				destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline: 'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
				ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
				link: 'rounded-md text-brand underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-5',
				sm: 'h-8 px-3.5 text-xs',
				lg: 'h-12 px-6 text-base',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, IButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';

	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export default Button;
