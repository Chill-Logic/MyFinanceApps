import { useCallback, useEffect, useRef } from 'react';

type TProps = {
	/* Arrastar pros lados troca o mês (só toque: celular e tablet). A animação vale sempre. */
	gesture: boolean;
	/* Troca o mês de fato (+1 = próximo, -1 = anterior). */
	onChange: (direction: 1 | -1)=> void;
};

const FILTER_ID = 'month-liquid';
const THRESHOLD = 70;
const OUT_MS = 190;
const IN_MS = 420;

/*
 * Filtro "líquido" (SVG): turbulência + deslocamento. Criado uma vez no <body>; o `scale` do deslocamento é
 * animado por quadro enquanto a lista anda e volta a 0 no fim — fora da animação o filtro nem fica aplicado.
 */
const ensureFilter = () => {
	let svg = document.getElementById(`${ FILTER_ID }-svg`) as Element | null;
	if (!svg) {
		const created = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		created.id = `${ FILTER_ID }-svg`;
		created.setAttribute('aria-hidden', 'true');
		created.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
		svg = created;
		created.innerHTML = `<filter id="${ FILTER_ID }" x="-15%" y="-5%" width="130%" height="110%" color-interpolation-filters="sRGB">`
			+ '<feTurbulence type="fractalNoise" baseFrequency="0.0035 0.014" numOctaves="1" seed="7" result="noise" />'
			+ '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />'
			+ '</filter>';
		document.body.appendChild(created);
	}
	return {
		displacement: svg.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement,
		turbulence: svg.querySelector('feTurbulence') as SVGFETurbulenceElement,
	};
};

/*
 * Troca de mês com efeito líquido (Início). O conteúdo do mês sai pro lado ondulando (distorção + esticada na
 * direção do movimento), o mês troca e o novo entra pelo outro lado assentando com quique. Pelas setas (qualquer
 * tamanho) chame `play(direção)`; com `gesture`, arrastar a lista também troca: o conteúdo segue o dedo, ondulando
 * mais quanto mais longe, e volta com mola se não passou do limite. Só assume o gesto quando ele é claramente
 * horizontal (o vertical segue rolando a lista). Com "reduzir movimento", só troca o mês.
 */
export const useMonthTransition = <T extends HTMLElement>({ gesture, onChange }: TProps) => {
	const ref = useRef<T>(null);
	const handler = useRef(onChange);
	handler.current = onChange;
	const busy = useRef(false);
	const frame = useRef(0);

	const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Aplica posição, ondulação (0–1) e opacidade de uma vez. */
	const paint = useCallback((x: number, wobble: number, opacity: number, transition = 'none') => {
		const element = ref.current;
		if (!element) return;
		const { displacement, turbulence } = ensureFilter();
		displacement.setAttribute('scale', String(Math.round(wobble * 26)));
		turbulence.setAttribute('baseFrequency', `${ (0.0035 + wobble * 0.0015).toFixed(4) } ${ (0.014 - wobble * 0.004).toFixed(4) }`);
		element.style.filter = wobble > 0.01 ? `url(#${ FILTER_ID })` : '';
		element.style.transition = transition;
		element.style.transform = x || wobble ? `translateX(${ x }px) scale(${ 1 + wobble * 0.035 }, ${ 1 - wobble * 0.02 })` : '';
		element.style.opacity = opacity >= 1 ? '' : String(opacity);
	}, []);

	/* Anima a ondulação de `from` até `to` em `ms`, junto com a transição CSS do transform/opacity. */
	const animateWobble = useCallback((from: number, to: number, ms: number, x: number, opacity: number, transition: string, done?: ()=> void) => {
		cancelAnimationFrame(frame.current);
		const started = performance.now();
		paint(x, from, opacity, transition);
		const step = (now: number) => {
			const t = Math.min(1, (now - started) / ms);
			const eased = 1 - Math.pow(1 - t, 3);
			const element = ref.current;
			const { displacement } = ensureFilter();
			const wobble = from + (to - from) * eased;
			displacement.setAttribute('scale', String(Math.round(wobble * 26)));
			if (element) element.style.filter = wobble > 0.01 ? `url(#${ FILTER_ID })` : '';
			if (t < 1) frame.current = requestAnimationFrame(step);
			else done?.();
		};
		frame.current = requestAnimationFrame(step);
	}, [ paint ]);

	/* Sai pro lado, troca o mês, entra pelo outro lado. */
	const play = useCallback((direction: 1 | -1, from_x = 0) => {
		const element = ref.current;
		if (!element) return;
		/*
		 * Já animando (clique ou gesto rápido): troca o mês NA HORA e deixa a animação em curso terminar. Nada é
		 * perdido nem pulado — cada pedido anda exatamente um mês.
		 */
		if (busy.current) {
			handler.current(direction);
			return;
		}
		if (reduce()) {
			paint(0, 0, 1);
			handler.current(direction);
			return;
		}
		busy.current = true;
		const width = element.clientWidth;
		animateWobble(Math.min(1, Math.abs(from_x) / 220), 1, OUT_MS, -direction * width * 0.45, 0, `transform ${ OUT_MS }ms cubic-bezier(0.55, 0, 0.9, 0.5), opacity ${ OUT_MS }ms ease-in`, () => {
			handler.current(direction);
			paint(direction * width * 0.32, 1, 0);
			requestAnimationFrame(() => requestAnimationFrame(() => {
				animateWobble(1, 0, IN_MS, 0, 1, `transform ${ IN_MS }ms cubic-bezier(0.22, 1.3, 0.36, 1), opacity 240ms ease-out`, () => {
					paint(0, 0, 1);
					busy.current = false;
				});
			}));
		});
	}, [ animateWobble, paint ]);

	useEffect(() => {
		const element = ref.current;
		if (!gesture || !element) return undefined;

		let start_x = 0;
		let start_y = 0;
		let delta = 0;
		let mode: 'idle' | 'horizontal' | 'vertical' = 'idle';

		const onStart = (event: TouchEvent) => {
			if (event.touches.length !== 1) return;
			start_x = event.touches[0].clientX;
			start_y = event.touches[0].clientY;
			delta = 0;
			mode = 'idle';
		};

		const onMove = (event: TouchEvent) => {
			const move_x = event.touches[0].clientX - start_x;
			const move_y = event.touches[0].clientY - start_y;
			if (mode === 'idle') {
				if (Math.abs(move_x) < 10 && Math.abs(move_y) < 10) return;
				mode = Math.abs(move_x) > Math.abs(move_y) * 1.4 ? 'horizontal' : 'vertical';
			}
			if (mode !== 'horizontal') return;
			event.preventDefault();
			delta = move_x;
			/* Durante uma animação o conteúdo é dela: só conta o gesto, sem mexer na posição. */
			if (reduce() || busy.current) return;
			paint(delta * 0.55, Math.min(0.75, Math.abs(delta) / 260), 1 - Math.min(0.3, Math.abs(delta) / 900));
		};

		const onEnd = () => {
			if (mode !== 'horizontal') return;
			mode = 'idle';
			if (Math.abs(delta) < THRESHOLD) {
				if (!reduce() && !busy.current) animateWobble(Math.min(0.75, Math.abs(delta) / 260), 0, 320, 0, 1, 'transform 320ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease');
				return;
			}
			play(delta < 0 ? 1 : -1, delta * 0.55);
		};

		element.addEventListener('touchstart', onStart, { passive: true });
		element.addEventListener('touchmove', onMove, { passive: false });
		element.addEventListener('touchend', onEnd);
		element.addEventListener('touchcancel', onEnd);

		return () => {
			element.removeEventListener('touchstart', onStart);
			element.removeEventListener('touchmove', onMove);
			element.removeEventListener('touchend', onEnd);
			element.removeEventListener('touchcancel', onEnd);
		};
	}, [ gesture, play, paint, animateWobble ]);

	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	return { ref, play };
};

export default useMonthTransition;
