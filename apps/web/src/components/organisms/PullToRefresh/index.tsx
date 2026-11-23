import { RefObject, useEffect, useId, useRef } from 'react';

import { Check, RefreshCw } from 'lucide-react';

/*
 * Puxar pra atualizar, no visual da marca: uma gota de vidro que cai. Só toque — no mouse nada disso dispara.
 * O desenho foi aprovado numa demo à parte (mockup); a geometria e os tempos aqui são os mesmos de lá.
 *
 * Gesto: escuta os toques em `rootRef` (a coluna de conteúdo do template). Só é assumido quando TODA área rolável
 * entre o dedo e a raiz está no topo — vale para a página que rola inteira (<main>) e para a lista da Início, que
 * rola por dentro — e quando o arrasto é claramente vertical pra baixo (mesmo critério de eixo do
 * arrastar-pra-trocar-mês, então os dois gestos não brigam). O conteúdo (`contentRef`) desce junto, com resistência.
 *
 * Animação, em quatro momentos:
 * 1. Puxando: a gota se forma pendurada no topo, cresce e pesa, presa por um "pescoço" que afina (filtro "goo":
 *    desfoque + limiar de alfa funde topo, pescoço e gota numa forma só). Perto do limite ela treme.
 * 2. Soltou depois do limite: cai com gravidade (t²), alongando; o pescoço arrebenta e volta pro topo.
 * 3. Bate e boia: achata no impacto e volta com mola, sobe e desce devagar, e o ícone gira até os dados voltarem.
 * 4. Fim: ✓ e a gota encolhe até sumir. Soltando antes do limite, ela só é puxada de volta pro topo.
 * É vidro o tempo todo: translúcida sobre uma lente que desfoca o que está atrás, com reflexo, arco de borda e
 * ponto de luz — que deslizam enquanto ela boia e somem junto quando ela encolhe.
 *
 * Desenho imperativo (atributos do SVG por `requestAnimationFrame`, sem state do React por quadro): são dezenas de
 * atributos a 60 fps, e re-renderizar o componente a cada quadro seria desperdício.
 */

type TPullToRefreshProps = {
	rootRef: RefObject<HTMLElement>;
	contentRef: RefObject<HTMLElement>;
	onRefresh: ()=> Promise<unknown>;
};

type TMode = 'idle' | 'pulling' | 'falling' | 'floating' | 'done';

/* Distância (já com resistência) pra disparar, onde a gota boia atualizando, e o máximo. */
const TRIGGER = 72;
const HOLD = 64;
const MAX = 124;
/* Raio da gota formada, centro horizontal do SVG e duração da queda. */
const R = 17;
const CX = 100;
const FALL_MS = 340;
/* Tempo mínimo boiando: atualização instantânea parecia um piscar, sem confirmar que rodou. */
const MIN_FLOAT = 700;

/* Resistência: no começo acompanha o dedo, depois fica cada vez mais pesado até o máximo. */
const resist = (finger: number) => MAX * (1 - Math.exp(-finger / 170));
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* Onde a gota fica pendurada, pelo quanto já foi puxado. */
const hanging = (pull: number) => {
	const p = clamp(pull / TRIGGER);
	const r = 4 + (R - 4) * p;
	return { p, r, y: 3 + r + 12 * p };
};

/* Primeira área rolável (no eixo Y) acima do toque que NÃO está no topo — se existir, a página não está no topo. */
const isScrolledDown = (target: EventTarget | null, root: HTMLElement) => {
	let element = target instanceof Element ? target : null;
	while (element && element !== root.parentElement) {
		if (element instanceof HTMLElement && element.scrollTop > 0) {
			const overflow = getComputedStyle(element).overflowY;
			if (overflow === 'auto' || overflow === 'scroll') return true;
		}
		element = element.parentElement;
	}
	return false;
};

const setEllipse = (element: SVGEllipseElement | null, cy: number, rx: number, ry: number) => {
	if (!element) return;
	element.setAttribute('cy', String(cy));
	element.setAttribute('rx', String(Math.max(0, rx)));
	element.setAttribute('ry', String(Math.max(0, ry)));
};

const PullToRefresh = ({ rootRef, contentRef, onRefresh }: TPullToRefreshProps) => {
	/* `useId` traz ":" — inválido dentro de `url(#...)` em alguns motores. */
	const id = useId().replace(/:/g, '');
	const on_refresh = useRef(onRefresh);
	on_refresh.current = onRefresh;

	/* Estado do gesto/animação (fora do React: muda a cada quadro). */
	const state = useRef({ mode: 'idle' as TMode, pull: 0, fall_start: 0, fall_from: 0, impact_at: 0, done_at: 0 });

	const wrap_ref = useRef<HTMLDivElement>(null);
	const lens_ref = useRef<HTMLDivElement>(null);
	const body_ref = useRef<SVGGElement>(null);
	const pool_ref = useRef<SVGEllipseElement>(null);
	const neck_ref = useRef<SVGEllipseElement>(null);
	const drop_ref = useRef<SVGEllipseElement>(null);
	const spec_ref = useRef<SVGEllipseElement>(null);
	const rim_ref = useRef<SVGPathElement>(null);
	const glint_ref = useRef<SVGCircleElement>(null);
	const caustic_ref = useRef<SVGPathElement>(null);
	const glyph_ref = useRef<HTMLDivElement>(null);
	const refresh_icon_ref = useRef<SVGSVGElement>(null);
	const check_icon_ref = useRef<SVGSVGElement>(null);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;
		const S = state.current;
		let frame: number | null = null;
		let pull_frame: number | null = null;

		const draw = (t: number) => {
			const { mode, pull } = S;
			const content = contentRef.current;
			/* Transform só durante o gesto: parado, nada de containing block novo pra elementos `fixed` da página. */
			if (content) content.style.transform = pull > 0.5 ? `translate3d(0, ${ pull * 0.42 }px, 0)` : '';
			const wrap = wrap_ref.current;
			if (!wrap) return;
			if (mode === 'idle' && pull < 0.5) {
				wrap.style.opacity = '0';
				return;
			}
			wrap.style.opacity = '1';

			let y: number;
			let rx: number;
			let ry: number;
			let pool = 0;
			let neck = 0;
			let spin = false;
			let rot = 0;
			let icon_opacity = 1;
			let sweep = 0;
			let check = false;

			if (mode === 'pulling' || mode === 'idle') {
				/* Pendurada: cresce e estica, presa ao topo por um pescoço que afina conforme pesa. */
				const h = hanging(pull);
				y = h.y;
				rx = h.r * (1 - 0.1 * h.p);
				ry = h.r * (1 + 0.2 * h.p);
				pool = 1;
				neck = 1 - 0.55 * h.p;
				rot = h.p * 300;
				icon_opacity = clamp((h.r - 10) / 5) * (pull >= TRIGGER ? 1 : 0.65);
				/* Pronta pra cair: treme de leve, como gota no limite. */
				if (pull >= TRIGGER) {
					const k = Math.sin(t / 45) * 0.03;
					rx *= 1 + k;
					ry *= 1 - k;
				}
				wrap.style.opacity = String(clamp(pull / 12));
			} else if (mode === 'falling') {
				/* Queda com gravidade (t²): a gota alonga com a velocidade; o pescoço arrebenta e volta pro topo. */
				const f = clamp((t - S.fall_start) / FALL_MS);
				y = S.fall_from + (HOLD - S.fall_from) * f * f;
				rx = R * (1 - 0.12 * f);
				ry = R * (1 + 0.22 * f);
				pool = clamp(1 - f * 2.5);
				neck = clamp(0.45 - f * 3);
				rot = 300 + f * 120;
			} else {
				/* Boiando: achata no impacto e volta com mola; depois sobe e desce devagar. */
				const dt = (t - S.impact_at) / 1000;
				const squash = 0.34 * Math.exp(-6.5 * dt) * Math.cos(19 * dt);
				const bob = Math.sin(dt * 3.2) * 1.6 * clamp(dt * 2);
				y = HOLD + squash * R * 0.55 + bob;
				rx = R * (1 + squash);
				ry = R * (1 - squash);
				spin = mode === 'floating';
				sweep = Math.sin(dt * 1.6) * 24;
				if (mode === 'done') {
					check = true;
					/* Some: encolhe descendo até desaparecer. */
					const k = clamp((t - S.done_at - 380) / 380);
					rx *= 1 - k;
					ry *= 1 - k;
					y += 8 * k;
					icon_opacity = 1 - k;
				}
			}

			setEllipse(pool_ref.current, -2, 12 * pool, 4 * pool);
			/* Pescoço: elipse fina entre o topo e a gota; o "goo" funde os três numa gota só. */
			const neck_bottom = Math.max(0, y - ry * 0.7);
			setEllipse(neck_ref.current, neck_bottom / 2, 4.2 * neck, neck > 0 ? neck_bottom / 2 : 0);
			setEllipse(drop_ref.current, y, rx, ry);

			/* Vidro: some junto com a gota quando ela encolhe (nada de ponto de luz sobrando). */
			const r = Math.min(rx, ry);
			const size = clamp((r - 3) / 8);
			if (body_ref.current) body_ref.current.style.opacity = String(1 - 0.3 * size);
			const lens = lens_ref.current;
			if (lens) {
				lens.style.width = `${ rx * 2 }px`;
				lens.style.height = `${ ry * 2 }px`;
				lens.style.top = `${ y - ry }px`;
				lens.style.marginLeft = `${ -rx }px`;
				lens.style.opacity = String(size);
			}

			/* Arco de borda só no alto-esquerdo (não é anel), girando junto com a luz. */
			const ra = (-150 + sweep) * Math.PI / 180;
			const rb = (-60 + sweep) * Math.PI / 180;
			rim_ref.current?.setAttribute('d', `M ${ CX + Math.cos(ra) * rx * 0.9 } ${ y + Math.sin(ra) * ry * 0.9 } A ${ rx * 0.9 } ${ ry * 0.9 } 0 0 1 ${ CX + Math.cos(rb) * rx * 0.9 } ${ y + Math.sin(rb) * ry * 0.9 }`);
			if (rim_ref.current) rim_ref.current.style.opacity = String(0.55 * size * size);
			const ga = (-35 + sweep) * Math.PI / 180;
			glint_ref.current?.setAttribute('cx', String(CX + Math.cos(ga) * rx * 0.66));
			glint_ref.current?.setAttribute('cy', String(y + Math.sin(ga) * ry * 0.66));
			if (glint_ref.current) glint_ref.current.style.opacity = String(0.9 * size * size);

			/* Reflexo em cima e cáustica embaixo, acompanhando a forma. */
			const sa = (-118 + sweep) * Math.PI / 180;
			const scx = CX + Math.cos(sa) * rx * 0.52;
			const scy = y + Math.sin(sa) * ry * 0.52;
			const spec = spec_ref.current;
			if (spec) {
				spec.setAttribute('cx', String(scx));
				spec.setAttribute('cy', String(scy));
				spec.setAttribute('rx', String(Math.max(0, rx * 0.36)));
				spec.setAttribute('ry', String(Math.max(0, ry * 0.2)));
				spec.setAttribute('transform', `rotate(${ sa * 180 / Math.PI + 90 } ${ scx } ${ scy })`);
				spec.style.opacity = String(clamp(r / 12) * 0.75 * size);
			}
			const cr = Math.max(0, r * 0.72);
			caustic_ref.current?.setAttribute('d', `M ${ CX - cr * 0.7 } ${ y + ry * 0.5 } A ${ cr } ${ cr } 0 0 0 ${ CX + cr * 0.7 } ${ y + ry * 0.5 }`);
			if (caustic_ref.current) caustic_ref.current.style.opacity = String(clamp(r / 12) * size);

			const glyph = glyph_ref.current;
			if (glyph) {
				glyph.style.top = `${ y }px`;
				glyph.style.opacity = String(icon_opacity * clamp((r - 9) / 5));
			}
			const refresh_icon = refresh_icon_ref.current;
			if (refresh_icon) {
				refresh_icon.style.display = check ? 'none' : '';
				refresh_icon.classList.toggle('animate-spin', spin);
				refresh_icon.style.transform = spin ? '' : `rotate(${ rot }deg)`;
			}
			if (check_icon_ref.current) check_icon_ref.current.style.display = check ? '' : 'none';
		};

		/* Laço de desenho: roda enquanto há gota na tela e para sozinho quando tudo volta ao repouso. */
		const loop = (t: number) => {
			draw(t);
			frame = S.mode === 'idle' && S.pull < 0.5 ? null : requestAnimationFrame(loop);
		};
		const ensureLoop = () => {
			if (frame === null) frame = requestAnimationFrame(loop);
		};

		const animatePull = (to: number, duration: number, ease: (t: number)=> number) => new Promise<void>((resolve) => {
			if (pull_frame) cancelAnimationFrame(pull_frame);
			const from = S.pull;
			const start = performance.now();
			const step = (now: number) => {
				const k = Math.min(1, (now - start) / duration);
				S.pull = from + (to - from) * ease(k);
				if (k < 1) pull_frame = requestAnimationFrame(step);
				else {
					pull_frame = null;
					resolve();
				}
			};
			pull_frame = requestAnimationFrame(step);
			ensureLoop();
		});

		let start_x = 0;
		let start_y = 0;
		let axis: 'idle' | 'vertical' | 'other' = 'idle';
		let armed = false;

		const onStart = (event: TouchEvent) => {
			armed = false;
			axis = 'idle';
			if (event.touches.length !== 1 || S.mode !== 'idle') return;
			/* Janela aberta (Radix trava a rolagem do body): o gesto é dela, não da página. */
			if (document.body.hasAttribute('data-scroll-locked')) return;
			if (isScrolledDown(event.target, root)) return;
			start_x = event.touches[0].clientX;
			start_y = event.touches[0].clientY;
			armed = true;
		};

		const onMove = (event: TouchEvent) => {
			if (!armed) return;
			const move_x = event.touches[0].clientX - start_x;
			const move_y = event.touches[0].clientY - start_y;
			if (axis === 'idle') {
				if (Math.abs(move_x) < 10 && Math.abs(move_y) < 10) return;
				/* Pra baixo e claramente vertical; qualquer outra coisa (rolar pra cima, arrastar o mês) não é nossa. */
				axis = move_y > 0 && Math.abs(move_y) * 1.4 > Math.abs(move_x) ? 'vertical' : 'other';
				if (axis === 'other') {
					armed = false;
					return;
				}
				S.mode = 'pulling';
			}
			event.preventDefault();
			S.pull = resist(Math.max(0, move_y - 10));
			ensureLoop();
		};

		const onEnd = async() => {
			if (!armed || axis !== 'vertical') return;
			armed = false;
			if (S.pull < TRIGGER) {
				await animatePull(0, 300, easeInOut);
				S.mode = 'idle';
				return;
			}
			/* Solta: a gota cai do ponto onde estava pendurada; o conteúdo assenta junto. */
			S.mode = 'falling';
			S.fall_start = performance.now();
			S.fall_from = hanging(S.pull).y;
			animatePull(HOLD, 420, easeOutBack);
			await wait(FALL_MS);
			S.mode = 'floating';
			S.impact_at = performance.now();
			const started = performance.now();
			try {
				await on_refresh.current();
			} catch {
				/* Falha de rede já vira toast nas próprias queries; aqui só encerra a animação. */
			}
			const elapsed = performance.now() - started;
			if (elapsed < MIN_FLOAT) await wait(MIN_FLOAT - elapsed);
			S.mode = 'done';
			S.done_at = performance.now();
			await wait(800);
			await animatePull(0, 420, easeInOut);
			S.mode = 'idle';
		};

		root.addEventListener('touchstart', onStart, { passive: true });
		root.addEventListener('touchmove', onMove, { passive: false });
		root.addEventListener('touchend', onEnd);
		root.addEventListener('touchcancel', onEnd);
		return () => {
			root.removeEventListener('touchstart', onStart);
			root.removeEventListener('touchmove', onMove);
			root.removeEventListener('touchend', onEnd);
			root.removeEventListener('touchcancel', onEnd);
			if (frame) cancelAnimationFrame(frame);
			if (pull_frame) cancelAnimationFrame(pull_frame);
			if (contentRef.current) contentRef.current.style.transform = '';
		};
	}, [ rootRef, contentRef ]);

	return (
		<div ref={wrap_ref} aria-hidden='true' className='pointer-events-none absolute inset-x-0 top-0 z-30 h-0 opacity-0'>
			{/* Lente: desfoca e satura o que está atrás da gota, do tamanho dela — é o que faz parecer vidro. */}
			<div ref={lens_ref} className='absolute left-1/2 rounded-full backdrop-blur-[8px] backdrop-brightness-[1.15] backdrop-saturate-[1.8]' />
			<svg width='200' height='200' viewBox='0 0 200 200' className='absolute left-1/2 top-0 -translate-x-1/2 overflow-visible drop-shadow-[0_6px_10px_rgba(5,18,26,0.55)]'>
				<defs>
					<filter id={`${ id }-goo`} x='0' y='-40' width='200' height='280' filterUnits='userSpaceOnUse'>
						<feGaussianBlur in='SourceGraphic' stdDeviation='5' result='blur' />
						<feColorMatrix in='blur' mode='matrix' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9' />
					</filter>
					<filter id={`${ id }-soft`} x='-50%' y='-50%' width='200%' height='200%'>
						<feGaussianBlur stdDeviation='1.2' />
					</filter>
					{/* Oliva da marca, fixo nos dois temas: luz em cima, borda mais escura. */}
					<radialGradient id={`${ id }-liquid`} cx='40%' cy='30%' r='75%'>
						<stop offset='0%' stopColor='hsl(80 48% 78%)' />
						<stop offset='55%' stopColor='hsl(81 38% 60%)' />
						<stop offset='100%' stopColor='hsl(84 34% 40%)' />
					</radialGradient>
				</defs>
				<g ref={body_ref} filter={`url(#${ id }-goo)`} fill={`url(#${ id }-liquid)`}>
					<ellipse ref={pool_ref} cx={CX} cy={-2} />
					<ellipse ref={neck_ref} cx={CX} />
					<ellipse ref={drop_ref} cx={CX} />
				</g>
				<ellipse ref={spec_ref} fill='white' filter={`url(#${ id }-soft)`} />
				<path ref={rim_ref} fill='none' stroke='white' strokeLinecap='round' strokeWidth={1.1} />
				<circle ref={glint_ref} r={1.5} fill='white' />
				<path ref={caustic_ref} fill='none' stroke='white' strokeOpacity={0.35} strokeLinecap='round' strokeWidth={1.6} filter={`url(#${ id }-soft)`} />
			</svg>
			<div ref={glyph_ref} className='absolute left-1/2 -ml-[9px] -mt-[9px] grid size-[18px] place-items-center text-navy'>
				<RefreshCw ref={refresh_icon_ref} className='size-4' strokeWidth={2.6} />
				<Check ref={check_icon_ref} className='size-4' strokeWidth={3} style={{ display: 'none' }} />
			</div>
		</div>
	);
};

export default PullToRefresh;
