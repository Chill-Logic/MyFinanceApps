import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';

import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = forwardRef<
	ElementRef<typeof PopoverPrimitive.Content>,
	ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 8, onWheel, onTouchMove, ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			ref={ref}
			align={align}
			sideOffset={sideOffset}
			/*
			 * Popover aberto dentro de um Dialog: o conteúdo vai num portal no <body>, FORA da janela, e o Dialog
			 * (react-remove-scroll) cancela no `document` todo wheel/touchmove que vem de fora dela — a lista não
			 * rolava no toque (celular e app). Parar a propagação aqui impede o evento de chegar no `document`.
			 */
			onWheel={(event) => {
				event.stopPropagation();
				onWheel?.(event);
			}}
			onTouchMove={(event) => {
				event.stopPropagation();
				onTouchMove?.(event);
			}}
			className={cn(
				/* Nunca maior que a tela: o Radix expõe o espaço disponível do lado escolhido em CSS vars. */
				'z-50 max-h-[var(--radix-popover-content-available-height)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
