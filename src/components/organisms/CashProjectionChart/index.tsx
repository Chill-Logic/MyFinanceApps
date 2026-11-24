import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { MONTH_NAMES_PT, MoneyUtils, type TCashProjectionPoint } from '@myfinance/shared';

interface IProps {
	points: TCashProjectionPoint[];
	lowest: TCashProjectionPoint;
	height?: number;
}

/* "2026-12-10" → "10 dez" (só string, sem fuso). */
const shortDay = (date: string) => {
	const [ , month, day ] = date.split('-');
	return `${ Number(day) } ${ MONTH_NAMES_PT[Number(month) - 1]?.slice(0, 3).toLowerCase() ?? '' }`;
};

/*
 * Gráfico de área do saldo projetado (fundo marinho fixo, como no mockup): linha oliva com degradê, marcador
 * âmbar no ponto mais baixo e, se o saldo cruza o zero, uma linha tracejada no zero. Passando o dedo/mouse,
 * mostra o saldo daquele dia. Desenhado em SVG com a largura real medida (sem esticar os marcadores).
 */
const CashProjectionChart = ({ points, lowest, height = 160 }: IProps) => {
	const container_ref = useRef<HTMLDivElement>(null);
	const [ width, setWidth ] = useState(0);
	const [ hover_index, setHoverIndex ] = useState<number | null>(null);

	useEffect(() => {
		const element = container_ref.current;
		if (!element) return undefined;
		const observer = new ResizeObserver(() => setWidth(element.clientWidth));
		observer.observe(element);
		setWidth(element.clientWidth);
		return () => observer.disconnect();
	}, []);

	if (points.length < 2) return <div ref={container_ref} style={{ height }} />;

	const pad_top = 16;
	const pad_bottom = 26;
	const values = points.map((point) => point.balance);
	const max = Math.max(...values, 0);
	const min = Math.min(...values, 0);
	const span = max - min || 1;
	const x = (index: number) => (index / (points.length - 1)) * width;
	const y = (value: number) => pad_top + ((max - value) / span) * (height - pad_top - pad_bottom);

	const line = points.map((point, index) => `${ index === 0 ? 'M' : 'L' }${ x(index).toFixed(1) } ${ y(point.balance).toFixed(1) }`).join(' ');
	const area = `${ line } L${ width } ${ height - pad_bottom } L0 ${ height - pad_bottom } Z`;
	const lowest_index = Math.max(0, points.findIndex((point) => point.date === lowest.date));
	const crosses_zero = min < 0 && max > 0;

	const active_index = hover_index ?? lowest_index;
	const active = points[active_index];
	const tooltip_left = Math.min(Math.max(x(active_index), 44), Math.max(width - 44, 44));

	const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const ratio = (event.clientX - rect.left) / rect.width;
		setHoverIndex(Math.round(Math.min(1, Math.max(0, ratio)) * (points.length - 1)));
	};

	/* Rótulos: início, fim e o ponto mais baixo — este só se não encostar nos outros dois (senão os textos se sobrepõem). */
	const lowest_fits = x(lowest_index) > 64 && x(lowest_index) < width - 64;
	const label_indexes = Array.from(new Set([ 0, ...(lowest_fits ? [ lowest_index ] : []), points.length - 1 ]));
	const labelAnchor = (index: number) => {
		if (index === 0) return 'start';
		return index === points.length - 1 ? 'end' : 'middle';
	};

	return (
		<div
			ref={container_ref}
			className='relative w-full touch-pan-y select-none'
			style={{ height }}
			onPointerMove={handlePointer}
			onPointerDown={handlePointer}
			onPointerLeave={() => setHoverIndex(null)}
		>
			{width > 0 && (
				<svg
					role='img'
					aria-label={`Projeção de ${ points.length - 1 } dias: menor saldo ${ MoneyUtils.formatSignedMoney(lowest.balance) } em ${ shortDay(lowest.date) }`}
					width={width}
					height={height}
					viewBox={`0 0 ${ width } ${ height }`}
					className='block'
				>
					<defs>
						<linearGradient id='cash-projection-area' x1='0' y1='0' x2='0' y2='1'>
							<stop offset='0%' stopColor='#A3BC74' stopOpacity='0.34' />
							<stop offset='100%' stopColor='#A3BC74' stopOpacity='0' />
						</linearGradient>
					</defs>
					{crosses_zero && (
						<line x1='0' x2={width} y1={y(0)} y2={y(0)} stroke='rgba(245,169,159,0.45)' strokeDasharray='3 5' />
					)}
					<path d={area} fill='url(#cash-projection-area)' />
					<path d={line} fill='none' stroke='#A3BC74' strokeWidth='2.5' strokeLinejoin='round' strokeLinecap='round' />
					<line x1={x(active_index)} x2={x(active_index)} y1={y(active.balance)} y2={height - pad_bottom} stroke='rgba(241,239,236,0.25)' strokeDasharray='2 4' />
					<circle cx={x(lowest_index)} cy={y(lowest.balance)} r='6' fill='#082435' stroke='#E9B949' strokeWidth='3' />
					{hover_index !== null && hover_index !== lowest_index && (
						<circle cx={x(hover_index)} cy={y(active.balance)} r='5' fill='#082435' stroke='#A3BC74' strokeWidth='3' />
					)}
					{label_indexes.map((index) => (
						<text
							key={index}
							x={x(index)}
							y={height - 6}
							fill='#A9B6BF'
							fontSize='11'
							textAnchor={labelAnchor(index)}
						>
							{shortDay(points[index].date)}
						</text>
					))}
				</svg>
			)}

			{/* Etiqueta do dia em foco: o ponto mais baixo, ou o dia sob o dedo/mouse */}
			{width > 0 && (
				<span
					className='pointer-events-none absolute flex -translate-x-1/2 flex-col items-center rounded-[10px] bg-sand-light px-2.5 py-1 text-xs text-navy shadow-[0_6px_20px_rgba(0,0,0,0.35)]'
					style={{ left: tooltip_left, top: Math.max(0, y(active.balance) - 52) }}
				>
					<span className='text-[#55626C]'>{shortDay(active.date)}</span>
					<span className='whitespace-nowrap font-bold'>{MoneyUtils.formatSignedMoney(active.balance)}</span>
				</span>
			)}
		</div>
	);
};

export default CashProjectionChart;
