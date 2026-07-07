import { ComponentPropsWithoutRef } from 'react';

import { Loader2 } from 'lucide-react';

import UiButton from '@/components/ui/button';

interface IProps extends ComponentPropsWithoutRef<typeof UiButton> {
	/**
     * Propriedade que desabilita e renderiza o loader dentro do Componente
     */
	isLoading?: boolean;
}

const Button = (props: IProps) => {
	const { isLoading = false, disabled, children, ...props_rest } = props;

	return (
		<UiButton disabled={disabled || isLoading} {...props_rest}>
			{isLoading && <Loader2 className='animate-spin' />}
			{children}
		</UiButton>
	);
};

export default Button;
