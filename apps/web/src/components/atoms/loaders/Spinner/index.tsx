import classNames from 'classnames';

interface IProps {
	variant?: 'default' | 'fixed' | 'backgrounded' | 'static';
	size?: number;
	color?: 'primary' | 'default' | 'danger' | 'dark-danger' | 'white';
	className?: string;
}

const Spinner = (props: IProps) => {
	const {
		variant = 'default',
		size = 55,
		color = 'white',
		className
	} = props;
	const styles = {
		wrapper: {
			base: 'h-full flex items-center justify-center',
			variant: {
				default: 'absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2',
				fixed: '',
				backgrounded: '',
				static: ''
			}
		},
		effects: {
			base: 'rounded-full border-[3px] border-transparent border-solid box-border border-l-[3px]',
			effect_1: 'absolute animate-rotate 1s',
			effect_2: 'absolute animate-rotateOpacity1',
			effect_3: 'animate-rotateOpacity2',
		},
		color: {
			primary: 'border-l-brand-main',
			default: 'border-l-title-low',
			white: 'border-l-white',
			danger: 'border-l-feedback-danger-default',
			'dark-danger': 'border-l-feedback-danger-dark'
		}
	};
	return (
		<div
			className={classNames(
				styles.wrapper.base,
				styles.wrapper.variant[variant],
				className
			)}
		>
			<div
				className={classNames(
					styles.effects.base,
					styles.effects.effect_1,
					styles.color[color]
				)}
				style={{
					height: size - 5,
					width: size - 5
				}}
			/>
			<div
				className={classNames(
					styles.effects.base,
					styles.effects.effect_2,
					styles.color[color]
				)}
				style={{
					height: size - 5,
					width: size - 5
				}}
			/>
			<div
				className={classNames(
					styles.effects.base,
					styles.effects.effect_3,
					styles.color[color]
				)}
				style={{
					height: size - 5,
					width: size - 5
				}}
			/>
		</div>
	);
};
export default Spinner;