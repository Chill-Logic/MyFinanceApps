import { type InputHTMLAttributes, type ReactNode, forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ArrowLeft, ArrowRight, CircleCheck, Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import { FIELD_SURFACE } from '@/components/ui/field';

/*
 * Peças das telas de autenticação (redesign 2026-11, mockup v3). Os campos aqui são mais altos que o padrão do app
 * (52px; 54px nos tablets) e o botão principal é a pílula de 54–56px com seta, como no mockup.
 */

export const AUTH_MIN_PASSWORD = 6;
export const AUTH_MAX_PASSWORD = 128;

/* Mesma regra da API (6 a 128), checada antes de enviar porque a mensagem do servidor pode vir em inglês. */
export const passwordProblem = (password: string, confirmation: string) => {
	if (password.length < AUTH_MIN_PASSWORD) return `A senha precisa ter pelo menos ${ AUTH_MIN_PASSWORD } caracteres.`;
	if (password.length > AUTH_MAX_PASSWORD) return `A senha pode ter no máximo ${ AUTH_MAX_PASSWORD } caracteres.`;
	if (password !== confirmation) return 'As senhas não coincidem.';
	return null;
};

interface IHeaderProps {
	title: string;
	subtitle?: ReactNode;
	/* Classes do subtítulo (ex.: esconder no celular, como no mockup). */
	subtitleClassName?: string;
}

export const AuthHeader = ({ title, subtitle, subtitleClassName }: IHeaderProps) => (
	<div className='mb-4 flex flex-col gap-1.5 px-1 md:px-0 lg:mb-5'>
		<h1 className='text-lg font-bold tracking-[-0.03em] md:text-2xl lg:text-[28px] xl:text-[30px]'>{title}</h1>
		{subtitle && (
			<p className={cn('text-sm leading-normal text-muted-foreground lg:text-[15px]', subtitleClassName)}>{subtitle}</p>
		)}
	</div>
);

interface IFieldProps extends InputHTMLAttributes<HTMLInputElement> {
	id: string;
	label: ReactNode;
	/* Algo à direita do rótulo (ex.: "Esqueci a senha"). */
	aside?: ReactNode;
	hint?: string;
	/* Senha com botão de mostrar/esconder. */
	revealable?: boolean;
	mono?: boolean;
}

export const AuthField = forwardRef<HTMLInputElement, IFieldProps>(
	({ id, label, aside, hint, revealable = false, mono = false, type, className, ...props }, ref) => {
		const [ shown, setShown ] = useState(false);
		let input_type = type;
		if (revealable) input_type = shown ? 'text' : 'password';

		return (
			<div className='flex flex-col gap-2'>
				<div className='flex items-center justify-between gap-3 px-1'>
					<label htmlFor={id} className='text-[13px] text-muted-foreground'>{label}</label>
					{aside}
				</div>
				<div className='relative'>
					<input
						ref={ref}
						id={id}
						name={id}
						type={input_type}
						className={cn(
							FIELD_SURFACE,
							'h-[52px] w-full text-[15px] md:h-[54px] md:text-base xl:h-[52px] xl:text-[15px]',
							revealable && 'pr-12',
							mono && 'font-mono tracking-[0.04em]',
							className
						)}
						{...props}
					/>
					{revealable && (
						<button
							type='button'
							onClick={() => setShown(!shown)}
							aria-label={shown ? 'Esconder senha' : 'Mostrar senha'}
							className='pressable absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground'
						>
							{shown ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
						</button>
					)}
				</div>
				{hint && <span className='px-1 text-xs text-muted-foreground'>{hint}</span>}
			</div>
		);
	}
);
AuthField.displayName = 'AuthField';

export const AuthSubmit = ({ children, isLoading, disabled }: { children: ReactNode; isLoading?: boolean; disabled?: boolean }) => (
	<Button type='submit' isLoading={isLoading} disabled={disabled} className='mt-3 h-14 w-full text-base font-bold xl:h-[54px]'>
		{children}
		{!isLoading && <ArrowRight className='size-4' strokeWidth={2.4} />}
	</Button>
);

export const AuthBackLink = () => (
	<div className='flex justify-center pt-3.5 text-sm'>
		<Link to='/auth/sign-in' className='pressable inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground'>
			<ArrowLeft className='size-[15px]' strokeWidth={2.2} />
			Voltar para o login
		</Link>
	</div>
);

export const AuthStatus = ({ children }: { children: ReactNode }) => (
	<div role='status' className='mt-1.5 flex items-start gap-2.5 rounded-2xl bg-success-soft px-4 py-3.5 text-sm leading-[1.45] text-success'>
		<CircleCheck className='mt-px size-[18px] shrink-0' strokeWidth={2.2} />
		<span>{children}</span>
	</div>
);

/* Link de texto no tom de marca (oliva legível), como "Criar conta". */
export const AuthLink = ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
	<Link to={to} className={cn('font-bold text-brand transition-opacity hover:opacity-80', className)}>{children}</Link>
);
