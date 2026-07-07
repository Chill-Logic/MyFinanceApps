import { InputHTMLAttributes, ReactElement, forwardRef } from 'react';
import InputMask from 'react-input-mask';

import { cn } from '@/lib/utils';

import { TError } from '@/types';

import Label from '@/components/ui/label';

interface IProps extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
	label?: string;
	type: InputHTMLAttributes<HTMLInputElement>['type'] | 'mask';
	mask?: string;
	rightBtnAction?: ()=> void;
	rightIconComponent?: ReactElement;
	leftIconComponent?: ReactElement;
	className?: string;
	supportText?: string;
	error?: TError<IProps['name']>;
	maskChar?: string | null;
}

const TextInput = forwardRef<any, IProps>((props, ref) => {
	const {
		mask, rightBtnAction, rightIconComponent, error, className,
		supportText, label, type, leftIconComponent, disabled, ...fieldProps
	} = props;

	const styles = {
		wrapper: 'flex flex-col gap-tiny relative',
		input: {
			base: 'flex h-giant-xx w-full rounded-lg border border-input bg-background px-small-xx text-small font-medium font-noto-sans text-foreground shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring',
			disabled: 'cursor-not-allowed opacity-50',
			invalid: '!border-destructive',
		},
		label: {
			invalid: '!text-destructive',
		},
		support_text: {
			base: 'text-muted-foreground font-noto-sans text-x-small font-light',
			invalid: '!text-destructive',
		},
		right_icon: {
			base: 'cursor-default hover:opacity-70 transition absolute right-3 top-1/2 -translate-y-1/2',
			icon: 'cursor-pointer',
		}
	};

	const mask_input_props = {
		...fieldProps,
		ref,
		disabled,
		type: 'text',
		mask: mask ?? '',
		className: cn(
			styles.input.base,
			disabled && styles.input.disabled,
			error !== undefined && styles.input.invalid,
		)
	};

	const input_props = {
		...fieldProps,
		ref,
		type,
		disabled,
		className: cn(
			styles.input.base,
			disabled && styles.input.disabled,
			error !== undefined && styles.input.invalid,
			type === 'textarea' && 'min-h-[130px] py-tiny',
		)
	};

	const inputs: any = {
		'mask': {
			tag: InputMask,
			input_props: mask_input_props
		},
		'textarea': {
			tag: 'textarea',
			input_props: {
				...input_props,
				rows: 4
			}
		},
		'text': {
			tag: 'input',
			input_props
		},
		'number': {
			tag: 'input',
			input_props
		},
		'email': {
			tag: 'input',
			input_props
		},
		'password': {
			tag: 'input',
			input_props
		},
		'date': {
			tag: 'input',
			input_props
		},
		'time': {
			tag: 'input',
			input_props
		}
	};

	const InputTag = inputs[type as keyof typeof inputs].tag;
	const input_tag_props = inputs[type as keyof typeof inputs].input_props;

	return (
		<div className={cn('w-full', className)}>
			<div className={styles.wrapper}>
				{label && (
					<Label
						className={cn(error !== undefined && styles.label.invalid)}
						htmlFor={fieldProps.name}
					>
						{label}
					</Label>
				)}

				<div className='relative flex items-center'>
					{leftIconComponent && (
						<div className='absolute left-3 top-1/2 -translate-y-1/2'>
							{leftIconComponent}
						</div>
					)}
					<InputTag
						id={fieldProps.name}
						{...input_tag_props}
					/>
					{rightIconComponent !== undefined && (
						<button
							type='button'
							onClick={() => rightBtnAction ? rightBtnAction() : null}
							className={cn(
								styles.right_icon.base,
								rightBtnAction !== undefined && styles.right_icon.icon,
							)}
						>
							{rightIconComponent}
						</button>
					)}
				</div>
			</div>

			{supportText && (
				<p className={cn(styles.support_text.base, error !== undefined && styles.support_text.invalid)}>
					{supportText}
				</p>
			)}
		</div>
	);
});

export default TextInput;
