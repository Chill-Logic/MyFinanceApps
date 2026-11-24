import { ComponentPropsWithoutRef, ElementRef, forwardRef } from 'react';

import { Loader2 } from 'lucide-react';

import UiButton from '@/components/ui/button';

interface IProps extends ComponentPropsWithoutRef<typeof UiButton> {
	/**
     * Propriedade que desabilita e renderiza o loader dentro do Componente
     */
	isLoading?: boolean;
}

const Button = forwardRef<ElementRef<typeof UiButton>, IProps>((props, ref) => {
	const { isLoading = false, disabled, children, ...props_rest } = props;

	/*
	 * Com `asChild` o Slot do Radix exige UM filho só — o `false` do loader conta como segundo filho e derruba a
	 * árvore inteira ("Slot failed to slot onto its children"). Nesse caso o filho vai sozinho.
	 */
	if (props_rest.asChild) {
		return <UiButton ref={ref} disabled={disabled || isLoading} {...props_rest}>{children}</UiButton>;
	}

	return (
		<UiButton ref={ref} disabled={disabled || isLoading} {...props_rest}>
			{isLoading && <Loader2 className='animate-spin' />}
			{children}
		</UiButton>
	);
});
Button.displayName = 'Button';

export default Button;
