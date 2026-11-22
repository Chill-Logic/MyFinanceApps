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
		<div className={cn('relative flex rounded-full border border-border bg-white p-[3px] dark:bg-[rgba(199,195,191,0.05)]', className)}>
			{/* Thumb oliva (cor primária) com o texto marinho, como no mockup do redesign. */}
			<div
				className='pointer-events-none absolute rounded-full bg-primary transition-transform duration-200 ease-out'
				style={{
					/* Posição no `style` (não em classes arbitrárias): sem top/bottom o thumb fica com altura 0 e some. */
					top: 3,
					bottom: 3,
					left: 3,
					width: `calc((100% - 6px) / ${ segments.length })`,
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
							/*
							 * `min-w-0` + texto menor em tela estreita: item de flex nasce com `min-width: auto` e
							 * não encolhe abaixo da palavra mais longa ("Recorrente"), esticando o trilho pra fora
							 * do container. Assim o segmento cabe na fração dele e o rótulo quebra se precisar.
							 */
							'relative z-10 flex min-h-[30px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1.5 py-1.5 text-center text-xs leading-tight transition-colors sm:px-4',
							active ? 'font-bold text-primary-foreground' : 'font-semibold text-muted-foreground hover:text-foreground',
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
