import { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';

import Loader from '@/components/atoms/loaders/Spinner';

interface IProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/**
     * Função executada no evento de clique do botão
     */
	onClick?: MouseEventHandler;
	/**
     * Texto ou Elemento HTML que será renderizado dentro do Componente
     */
	children?: ReactNode | ReactNode[];
	/**
     * className personalizada do Componente
     */
	className?: string;
	/**
     * Propríedade que desabilita botão e evento de clique
     */
	disabled?: boolean;
	/**
     * Estilo do Componente: `outline`, `text` e `contained`
     *
     * @default contained
     */
	variant?: 'outlined' | 'contained';
	/**
     * Formatos do Componente: `block`, `square`, `contained`
     *
     * @default contained
     */
	type?: 'button' | 'submit' | 'reset';
	/**
     * Cores do Componente: `primary`, `secondary`, `error`
     *
     * @default primary
     */
	theme?: 'primary' | 'secondary' | 'danger';
	/**
     * Tamanhos do Componente: `lg`, `md`, `sm`
     */
	size?: 'md' | 'sm' | 'lg';
	/**
     * Propriedade que desabilita e renderiza o loader dentro do Componente
     */
	isLoading?: boolean;
	/**
     * Tamanho máximo do Componente
     */
	maxWidth?: string;
}

const 	Button = (props: IProps) => {
	const {
		children,
		onClick,
		className,
		theme = 'primary',
		size = 'sm',
		variant = 'contained',
		disabled,
		type = 'button',
		isLoading = false,
		...props_rest
	} = props;

	const styles = {
		base: 'font-noto-sans relative font-medium align-middle flex items-center justify-center focus:outline-none transition ease-in-out duration-300',
		loading: '!text-transparent cursor-not-allowed',
		disabled: {
			outlined: 'border bg-transparent border-title-light text-title-light cursor-not-allowed',
			contained: 'bg-paragraph-light text-title-light cursor-not-allowed'
		},
		size: {
			sm: 'py-tiny px-small-xx rounded-small text-small font-light gap-base h-giant-xx',
			md: 'py-tiny px-small-xx rounded-small text-default font-normal gap-tiny',
			lg: 'py-tiny px-small-xx rounded-small text-default font-normal gap-tiny w-full',
		},
		variants: {
			primary: {
				outlined: {
					base: 'border border-solid border-background-default bg-transparent text-background-default',
					hover: 'hover:bg-background-default/[0.12] '
				},
				contained: {
					base: 'bg-background-default dark:bg-brand-tertiary text-white',
					hover: 'hover:shadow-md hover:shadow-background-default/40 dark:hover:shadow-brand-tertiary/40'
				},
			},
			secondary: {
				outlined: {
					base: 'border border-solid border-title-light bg-brand-tertiary text-title-light font-normal',
					hover: 'hover:bg-paragraph-dark/[0.12]'
				},
				contained: {
					base: 'bg-brand-secondary text-text-dark',
					hover: 'hover:shadow-md hover:shadow-brand-secondary/40'
				}
			},
			danger: {
				outlined: {
					base: 'border border-solid border-feedback-danger-dark bg-transparent text-feedback-danger-dark',
					hover: 'hover:bg-feedback-danger-dark/[0.12]'
				},
				contained: {
					base: 'bg-feedback-danger-dark text-white',
					hover: 'hover:shadow-md hover:shadow-feedback-danger-dark/40'
				}
			}
		}
	};

	const button_props: ButtonHTMLAttributes<HTMLButtonElement> = {
		onClick,
		disabled: disabled || isLoading,
		type,
		className: classNames(
			styles.base,
			styles.size[size],
			{ [styles.disabled[variant]]: disabled },
			{ [styles.loading]: isLoading && !disabled },
			{ [styles.variants[theme][variant].base]: !disabled },
			{ [styles.variants[theme][variant].hover]: !disabled && !isLoading },
			className
		),
		...props_rest
	};

	return (
		<button {...button_props}>
			{isLoading && (
				<Loader
					color={variant === 'outlined' ? theme : 'white' as any}
					size={23}
				/>
			)}
			{children}
		</button>
	);
};

export default Button;