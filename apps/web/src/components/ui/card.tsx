import { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
	<div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
);

const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
	<div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);

const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
	<h3 className={cn('text-sm font-medium text-muted-foreground', className)} {...props} />
);

const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
	<div className={cn('p-6 pt-0', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardContent };
