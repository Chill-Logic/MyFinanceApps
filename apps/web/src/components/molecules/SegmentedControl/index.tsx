import { cn } from '@/lib/utils';

export type TSegment = {
	value: string;
	label: string;
	icon?: React.ComponentType<{ className?: string }>;
};

interface IProps {
	segments: TSegment[];
	value: string;
	onChange: (value: string)=> void;
	className?: string;
}

/*
 * Segmented control com "thumb" (a pílula do item ativo) que DESLIZA entre os segmentos em vez de
 * saltar. O thumb é um `<div>` posicionado absolutamente, animado por `translateX` com
 * `transition-transform` — largura = fração igual do trilho, deslocamento = índice ativo * 100% da
 * própria largura (segmentos são `flex-1` sem gap, então cai exato no lugar).
 */
const SegmentedControl = ({ segments, value, onChange, className }: IProps) => {
	const active_index = Math.max(0, segments.findIndex((segment) => segment.value === value));

	return (
		<div className={cn('relative flex rounded-lg bg-muted p-1', className)}>
			<div
				className='pointer-events-none absolute inset-y-1 left-1 rounded-md bg-card shadow-sm transition-transform duration-200 ease-out'
				style={{
					width: `calc((100% - 0.5rem) / ${ segments.length })`,
					transform: `translateX(${ active_index * 100 }%)`,
				}}
			/>

			{segments.map((segment) => {
				const Icon = segment.icon;
				const active = segment.value === value;

				return (
					<button
						key={segment.value}
						type='button'
						onClick={() => onChange(segment.value)}
						className={cn(
							'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
							active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						{Icon && <Icon className='h-4 w-4' />}
						{segment.label}
					</button>
				);
			})}
		</div>
	);
};

export default SegmentedControl;
