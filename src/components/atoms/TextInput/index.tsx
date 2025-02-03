import { InputHTMLAttributes, ReactElement, forwardRef } from 'react';
import InputMask from 'react-input-mask';

import classNames from 'classnames';

import { TError } from '@/types';

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
		wrapper: 'flex flex-col-reverse relative ',
		input: {
			base: 'h-giant-xx w-full border border-stroke-dark rounded-lg  px-small-xx bg-background-input text-dark font-noto-sans text-small font-medium transition durantion-200 outline-none',
			placeholder: 'placeholder-text-dark placeholder:font-normal',
			filled: 'font-normal',
			disabled: 'cursor-not-allowed !bg-stroke-light !text-stroke-dark',
			invalid: '!border-feedback-danger-dark',
			leftIcon: ''
		},
		label: {
			base: 'text-paragraph-dark font-noto-sans text-small font-medium mb-tiny',
			invalid: '!text-feedback-danger-dark'
		},
		support_text: {
			base: 'text-stroke-dark font-noto-sans text-x-small font-light mt-tiny',
			invalid: '!text-feedback-danger-dark',
		},
		left_icon: '',
		right_icon: {
			base: 'cursor-default hover:opacity-70 transition absolute right-3 bottom-2',
			icon: 'cursor-pointer',
		}
	};

	const mask_input_props = {
		...fieldProps,
		ref,
		disabled,
		type: 'text',
		mask: mask ?? '',
		className: classNames(
			styles.input.base,
			styles.input.placeholder,
			{
				[styles.input.disabled]: disabled,
				[styles.input.invalid]: error !== undefined,
				[styles.input.filled]: props.value !== '',
				[styles.input.leftIcon]: leftIconComponent !== undefined
			}
		)
	};

	const input_props = {
		...fieldProps,
		ref,
		type,
		disabled,
		className: classNames(
			styles.input.base,
			styles.input.placeholder,
			{
				[styles.input.disabled]: disabled,
				[styles.input.invalid]: error !== undefined,
				[styles.input.filled]: props.value !== '',
				[styles.input.leftIcon]: leftIconComponent !== undefined,
				'min-h-[130px] py-tiny': type === 'textarea'
			}
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
		<div className={classNames('w-full', className)}>
			<div className={styles.wrapper}>
				{leftIconComponent && (
					<div className={styles.left_icon}>
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
						className={classNames(
							styles.right_icon.base,
							{ [styles.right_icon.icon]: rightBtnAction !== undefined }
						)}
					>
						{rightIconComponent}
					</button>
				)}
				{label && (
					<label
						className={classNames(
							styles.label.base,
							{ [styles.label.invalid]: error !== undefined }
						)}
						htmlFor={fieldProps.name}
					>
						{label}
					</label>
				)}
			</div>

			{supportText && (
				<p className={classNames(
					styles.support_text.base,
					{ [styles.support_text.invalid]: error !== undefined }
				)}
				>
					{supportText}
				</p>
			)}
		</div>
	);
});

export default TextInput;