import { HTMLAttributes } from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/*
 * Selo/etiqueta em pílula para estados e contadores ("pendente", "prevista", "2 para conferir",
 * "fatura atual"). Fundo translúcido do papel + texto do mesmo papel, que acompanham o tema
 * (`*-soft` + cor). `dot` mostra uma bolinha à esquerda (estado "vivo", como pendente).
 */
export const badgeVariants = cva(
	'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5',
	{
		variants: {
			variant: {
				neutral: 'bg-muted text-muted-foreground',
				outline: 'border border-border text-muted-foreground',
				brand: 'bg-primary/15 text-brand',
				success: 'bg-success-soft text-success',
				warning: 'bg-warning-soft text-warning',
				info: 'bg-info-soft text-info',
				danger: 'bg-danger-soft text-danger',
			},
		},
		defaultVariants: {
			variant: 'neutral',
		},
	},
);

const DOT_COLOR: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
	neutral: 'bg-muted-foreground',
	outline: 'bg-muted-foreground',
	brand: 'bg-primary',
	success: 'bg-success',
	warning: 'bg-warning-dot',
	info: 'bg-info',
	danger: 'bg-danger',
};

interface IBadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
	dot?: boolean;
}

const Badge = ({ className, variant, dot = false, children, ...props }: IBadgeProps) => (
	<span className={cn(badgeVariants({ variant }), className)} {...props}>
		{dot && <span aria-hidden='true' className={cn('h-1.5 w-1.5 rounded-full', DOT_COLOR[variant ?? 'neutral'])} />}
		{children}
	</span>
);

export default Badge;
