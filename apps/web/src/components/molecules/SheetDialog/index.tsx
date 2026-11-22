import { type ComponentPropsWithoutRef, type FormEvent, forwardRef, type ReactNode } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { GLASS_PANEL, GLASS_TILE } from '@/components/molecules/NavKit';
import { FIELD_SURFACE } from '@/components/ui/field';

/*
 * Casco das janelas menores (redesign 2026-11, mockup v3 "Dlg*"):
 *   - Celular: folha de VIDRO que sobe de baixo, a 8px das bordas, raio 32px, com alça. Fecha pelo × e por fora;
 *     um botão principal de largura total (sem "Cancelar").
 *   - Tablet/desktop: diálogo de vidro centralizado (560px, `wide` = 600px), raio 28px, rodapé com "Cancelar"
 *     (ghost) e o principal à direita; a ação destrutiva (se houver) à esquerda.
 * Cabeçalho: título 20px + linha de contexto (ícone + texto) + × redondo. O corpo rola por dentro.
 */

interface ISheetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean)=> void;
	title: ReactNode;
	/* Linha de contexto embaixo do título ("Na carteira Casa", "NUBANK · fatura de dezembro"). */
	context?: ReactNode;
	contextIcon?: LucideIcon;
	/* Texto explicativo embaixo do contexto. */
	description?: ReactNode;
	wide?: boolean;
	/* Envolve o corpo e o rodapé num <form> (Enter envia). */
	onSubmit?: (event: FormEvent)=> void;
	footer?: ReactNode;
	children: ReactNode;
	className?: string;
	/* Pra filhos que mandam foco no primeiro campo de texto. */
	autoFocus?: boolean;
	/* `false` = sem ×, sem fechar por fora nem pelo Escape/voltar (aviso obrigatório). */
	dismissible?: boolean;
}

export const SheetDialog = ({
	open, onOpenChange, title, context, contextIcon: ContextIcon, description, wide = false, onSubmit, footer, children, className, autoFocus = false, dismissible = true,
}: ISheetDialogProps) => {
	const Body = onSubmit ? 'form' : 'div';

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className='fixed inset-0 z-50 bg-navy/35 backdrop-blur-[6px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/55' />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					onInteractOutside={dismissible ? undefined : (event) => event.preventDefault()}
					onEscapeKeyDown={dismissible ? undefined : (event) => event.preventDefault()}
					onOpenAutoFocus={autoFocus ? undefined : (event) => event.preventDefault()}
					className={cn(
						GLASS_PANEL,
						'fixed z-50 flex flex-col overflow-hidden text-foreground outline-none',
						/* Celular: folha presa embaixo, flutuando 8px. */
						'inset-x-2 bottom-[calc(8px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] max-h-[calc(100dvh-24px-var(--safe-area-inset-top,env(safe-area-inset-top,0px))-var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))] rounded-[32px]',
						'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 max-md:data-[state=closed]:slide-out-to-bottom-1/2 max-md:data-[state=open]:slide-in-from-bottom-1/3 data-[state=open]:duration-[420ms] data-[state=open]:ease-[cubic-bezier(0.22,1.2,0.36,1)] data-[state=closed]:duration-200',
						/* Tablet/desktop: diálogo central. */
						'md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[calc(100dvh-48px)] md:w-[calc(100%-48px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95',
						wide ? 'md:max-w-[600px]' : 'md:max-w-[560px]',
						className,
					)}
				>
					<span aria-hidden='true' className='mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 md:hidden' />
					<div className='flex shrink-0 items-start gap-3 px-5 pb-3 pt-3 md:px-7 md:pt-7'>
						<div className='flex min-w-0 flex-1 flex-col gap-1'>
							<DialogPrimitive.Title className='text-xl font-bold tracking-[-0.02em]'>{title}</DialogPrimitive.Title>
							{context && (
								<span className='flex items-center gap-1.5 text-[13px] text-muted-foreground'>
									{ContextIcon && <ContextIcon className='size-3.5 shrink-0' />}
									<span className='min-w-0 truncate'>{context}</span>
								</span>
							)}
							{description && <p className='pt-1 text-sm text-muted-foreground'>{description}</p>}
						</div>
						{dismissible && (
							<DialogPrimitive.Close aria-label='Fechar' className={cn('pressable flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', GLASS_TILE)}>
								<X className='size-4' />
							</DialogPrimitive.Close>
						)}
					</div>
					<Body
						onSubmit={onSubmit}
						noValidate={onSubmit ? true : undefined}
						className='flex min-h-0 flex-1 flex-col'
					>
						<div className='no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 pb-2 pt-1 md:px-7'>
							{children}
						</div>
						{footer && (
							<div className='flex shrink-0 flex-col-reverse gap-2 px-5 pb-5 pt-3 md:flex-row md:items-center md:justify-end md:px-7 md:pb-7 md:pt-4'>
								{footer}
							</div>
						)}
					</Body>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
};

/*
 * Rodapé padrão: no celular só o principal (largura total) e a ação extra (ex.: Excluir), sem "Cancelar"; no
 * tablet/desktop extra à esquerda, "Cancelar" e o principal à direita.
 */
interface IFooterProps {
	submitLabel: ReactNode;
	onCancel: ()=> void;
	isLoading?: boolean;
	disabled?: boolean;
	/* Sem form: o principal chama isto. */
	onSubmit?: ()=> void;
	extra?: ReactNode;
	destructive?: boolean;
}

export const SheetDialogFooter = ({ submitLabel, onCancel, isLoading, disabled, onSubmit, extra, destructive }: IFooterProps) => (
	<>
		{extra && <div className='flex md:mr-auto'>{extra}</div>}
		<Button type='button' variant='ghost' onClick={onCancel} disabled={isLoading} className='h-12 px-5 max-md:hidden'>
			Cancelar
		</Button>
		<Button
			type={onSubmit ? 'button' : 'submit'}
			onClick={onSubmit}
			variant={destructive ? 'destructive' : 'default'}
			isLoading={isLoading}
			disabled={disabled || isLoading}
			className='h-12 px-7 font-bold max-md:w-full'
		>
			{submitLabel}
		</Button>
	</>
);

/* ---------- Campos ---------- */

export const FIELD_LABEL = 'px-1 text-[13px] text-muted-foreground';
export const FIELD_INPUT = cn(FIELD_SURFACE, 'h-[52px] w-full rounded-2xl text-[15px]');

interface IFieldProps {
	label: ReactNode;
	htmlFor?: string;
	hint?: ReactNode;
	error?: ReactNode;
	className?: string;
	children: ReactNode;
}

export const Field = ({ label, htmlFor, hint, error, className, children }: IFieldProps) => (
	<div className={cn('flex min-w-0 flex-col gap-2', className)}>
		<label htmlFor={htmlFor} className={FIELD_LABEL}>{label}</label>
		{children}
		{error && <span className='px-1 text-xs text-destructive'>{error}</span>}
		{!error && hint && <span className='px-1 text-xs text-muted-foreground'>{hint}</span>}
	</div>
);

/* Input com prefixo/sufixo fixos ("R$", "dia", "•••• "). */
/* `prefix` nativo do <input> (só texto) sai do tipo: aqui ele é o que aparece antes do valor (texto ou ícone). */
export const AffixInput = forwardRef<HTMLInputElement, Omit<ComponentPropsWithoutRef<'input'>, 'prefix'> & { prefix?: ReactNode; suffix?: ReactNode; strong?: boolean }>(
	({ prefix, suffix, strong, className, ...props }, ref) => (
		<div className='relative'>
			{prefix && <span className='pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground'>{prefix}</span>}
			<input
				ref={ref}
				className={cn(FIELD_INPUT, prefix && 'pl-11', suffix && 'pr-12', strong && 'text-lg font-bold', className)}
				{...props}
			/>
			{suffix && <span className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground'>{suffix}</span>}
		</div>
	)
);
AffixInput.displayName = 'AffixInput';

/* Cartão de rádio (opção única): borda e fundo oliva quando escolhido; `warning` = opção perigosa (amarelo). */
interface IRadioCardProps {
	checked: boolean;
	onSelect: ()=> void;
	title: ReactNode;
	description?: ReactNode;
	trailing?: ReactNode;
	badge?: ReactNode;
	warning?: boolean;
	disabled?: boolean;
	className?: string;
}

export const RadioCard = ({ checked, onSelect, title, description, trailing, badge, warning, disabled, className }: IRadioCardProps) => (
	<button
		type='button'
		role='radio'
		aria-checked={checked}
		disabled={disabled}
		onClick={onSelect}
		className={cn(
			'pressable flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-50',
			!checked && cn(GLASS_TILE, 'hover:bg-white/40 dark:hover:bg-white/[0.06]'),
			checked && !warning && 'border-primary/70 bg-primary/[0.12]',
			checked && warning && 'border-warning-dot/70 bg-warning-soft',
			className,
		)}
	>
		<span className={cn(
			'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-foreground/25',
			checked && !warning && 'border-primary',
			checked && warning && 'border-warning-dot',
		)}
		>
			{checked && <span className={cn('size-2.5 rounded-full', warning ? 'bg-warning-dot' : 'bg-primary')} />}
		</span>
		<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
			<span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
				<span className='font-semibold'>{title}</span>
				{badge}
			</span>
			{description && <span className='text-xs text-muted-foreground'>{description}</span>}
		</span>
		{trailing && <span className='shrink-0 text-right text-sm font-semibold'>{trailing}</span>}
	</button>
);

/* Caixa de aviso/ajuda (tom: info, warning, danger, neutral). */
export const Notice = ({ tone = 'neutral', icon: Icon, children, className }: { tone?: 'info' | 'warning' | 'danger' | 'neutral'; icon?: LucideIcon; children: ReactNode; className?: string }) => (
	<p className={cn(
		'flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm',
		tone === 'info' && 'bg-info-soft text-foreground',
		tone === 'warning' && 'bg-warning-soft text-warning',
		tone === 'danger' && 'bg-danger-soft text-destructive',
		tone === 'neutral' && cn(GLASS_TILE, 'text-muted-foreground'),
		className,
	)}
	>
		{Icon && <Icon className='mt-0.5 size-4 shrink-0' />}
		<span className='min-w-0'>{children}</span>
	</p>
);

/* Bloco de resumo em vidro leve (ex.: valor da fatura, transação que chegou do banco). */
export const SummaryTile = ({ children, className }: { children: ReactNode; className?: string }) => (
	<div className={cn('flex flex-col gap-3 rounded-[22px] p-4', GLASS_TILE, className)}>{children}</div>
);

export default SheetDialog;
