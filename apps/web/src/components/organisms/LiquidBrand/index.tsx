import { type RefObject, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { LIQUID_FRAGMENT, LIQUID_VERTEX } from './shader';

interface IProps {
	/* Elemento que marca onde fica o losango de vidro (o shader lê a posição e o tamanho dele a cada quadro). */
	markRef: RefObject<HTMLElement>;
	className?: string;
}

/* Cores do logo (iguais às do mockup). */
const NAVY = [ 8 / 255, 36 / 255, 53 / 255 ];
const TEAL = [ 59 / 255, 142 / 255, 168 / 255 ];
const OLIVE = [ 143 / 255, 166 / 255, 92 / 255 ];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type TPermissionEvent = { requestPermission?: ()=> Promise<'granted' | 'denied'> };

/*
 * Fundo líquido + logo de vidro das telas de autenticação, em WebGL2 (um shader só, ver shader.ts).
 *
 * Mexe com: o ponteiro (redemoinho em volta e inclinação do vidro; segurar gira mais), e no celular o giroscópio
 * (a luz e o vidro seguem a inclinação, contada a partir da posição em que a tela abriu, que vai se reajustando
 * devagar). No iPhone o giroscópio só libera com permissão, pedida no primeiro toque no fundo.
 * Sem WebGL fica o fundo marinho do pai; com "reduzir movimento" desenha um quadro parado; pausa com a aba oculta.
 */
const LiquidBrand = ({ markRef, className }: IProps) => {
	const canvas_ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvas_ref.current;
		const gl = canvas?.getContext('webgl2', { alpha: false, antialias: false });
		if (!canvas || !gl) return undefined;

		const compile = (kind: number, source: string) => {
			const shader = gl.createShader(kind);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				// eslint-disable-next-line no-console
				console.error('LiquidBrand:', gl.getShaderInfoLog(shader));
				return null;
			}
			return shader;
		};
		const vertex = compile(gl.VERTEX_SHADER, LIQUID_VERTEX);
		const fragment = compile(gl.FRAGMENT_SHADER, LIQUID_FRAGMENT);
		const program = gl.createProgram();
		if (!vertex || !fragment || !program) return undefined;
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
		gl.useProgram(program);

		const at = (name: string) => gl.getUniformLocation(program, name);
		const u = {
			time: at('uTime'), resolution: at('uResolution'), mouse: at('uMouse'), press: at('uPress'),
			center: at('uCenter'), size: at('uSize'), navy: at('uNavy'), teal: at('uTeal'), olive: at('uOlive'),
			refract: at('uRefract'), swirl: at('uSwirl'), tilt: at('uTilt'),
		};
		gl.uniform3fv(u.navy, NAVY);
		gl.uniform3fv(u.teal, TEAL);
		gl.uniform3fv(u.olive, OLIVE);
		gl.uniform1f(u.refract, 0.5);
		gl.uniform1f(u.swirl, 1.2);
		gl.uniform1f(u.tilt, 1);

		const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
		const coarse = window.matchMedia('(pointer: coarse)').matches;

		let raf = 0;
		let last = performance.now();
		let time = 12;
		let aim = [ 0.5, 0.5 ];
		let mouse = [ 0.5, 0.5 ];
		let press = 0;
		let down = false;
		let pointer_inside = false;
		let gyro: number[] | null = null;
		let gyro_base: number[] | null = null;
		let asked_permission = false;

		const resize = () => {
			/* Efeito borrado: resolução reduzida não aparece e poupa bateria (mais ainda no celular). */
			const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (coarse ? 0.6 : 0.85);
			const width = Math.max(2, Math.round(canvas.clientWidth * scale));
			const height = Math.max(2, Math.round(canvas.clientHeight * scale));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
		};

		const draw = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			const still = calm.matches;
			if (!still) time += dt;

			if (gyro && !pointer_inside) {
				aim = gyro;
			} else if (!pointer_inside && !still) {
				aim = [ 0.5 + 0.3 * Math.sin(time * 0.37), 0.5 + 0.24 * Math.sin(time * 0.53 + 1.1) ];
			}
			const k = 1 - Math.pow(0.86, dt * 60);
			mouse = [ mouse[0] + (aim[0] - mouse[0]) * k, mouse[1] + (aim[1] - mouse[1]) * k ];
			press += ((down ? 1 : 0) - press) * k;

			resize();
			const box = canvas.getBoundingClientRect();
			const mark = markRef.current?.getBoundingClientRect();
			const sx = canvas.width / (box.width || 1);
			const sy = canvas.height / (box.height || 1);
			if (mark) {
				gl.uniform2f(u.center, (mark.left + mark.width / 2 - box.left) * sx, (box.bottom - mark.top - mark.height / 2) * sy);
				gl.uniform1f(u.size, (mark.width / 2) * sx);
			}

			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.uniform1f(u.time, time);
			gl.uniform2f(u.resolution, canvas.width, canvas.height);
			gl.uniform2f(u.mouse, mouse[0], mouse[1]);
			gl.uniform1f(u.press, press);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};

		const loop = (now: number) => {
			draw(now);
			raf = calm.matches || document.hidden ? 0 : requestAnimationFrame(loop);
		};
		const start = () => {
			if (raf) return;
			last = performance.now();
			if (calm.matches) draw(last);
			else raf = requestAnimationFrame(loop);
		};
		const stop = () => {
			cancelAnimationFrame(raf);
			raf = 0;
		};

		/* Giroscópio: inclinação a partir da pose inicial, que se reajusta devagar (quem muda de posição não fica com tudo torto). */
		const onOrientation = (event: DeviceOrientationEvent) => {
			if (event.beta === null || event.gamma === null) return;
			const pose = [ event.gamma, event.beta ];
			gyro_base = gyro_base ?? pose;
			gyro_base = [ gyro_base[0] + (pose[0] - gyro_base[0]) * 0.01, gyro_base[1] + (pose[1] - gyro_base[1]) * 0.01 ];
			let dx = clamp((pose[0] - gyro_base[0]) / 30, -1, 1);
			let dy = clamp((pose[1] - gyro_base[1]) / 30, -1, 1);
			const angle = ((window.screen.orientation?.angle ?? 0) * Math.PI) / 180;
			[ dx, dy ] = [ dx * Math.cos(angle) + dy * Math.sin(angle), dy * Math.cos(angle) - dx * Math.sin(angle) ];
			gyro = [ 0.5 + dx * 0.38, 0.5 + dy * 0.38 ];
			if (calm.matches) draw(performance.now());
		};
		const askPermission = () => {
			if (asked_permission) return;
			asked_permission = true;
			const request = (window.DeviceOrientationEvent as unknown as TPermissionEvent | undefined)?.requestPermission;
			if (typeof request !== 'function') return;
			request().then((state) => {
				if (state === 'granted') window.addEventListener('deviceorientation', onOrientation);
			}).catch(() => {});
		};

		const point = (event: PointerEvent) => {
			const box = canvas.getBoundingClientRect();
			aim = [ (event.clientX - box.left) / (box.width || 1), 1 - (event.clientY - box.top) / (box.height || 1) ];
			pointer_inside = true;
			if (calm.matches) draw(performance.now());
		};
		const onMove = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' || down) point(event);
		};
		const onDown = (event: PointerEvent) => {
			down = true;
			point(event);
			askPermission();
		};
		/* Dedo: só manda enquanto encosta; mouse: enquanto está em cima. */
		const onUp = (event: PointerEvent) => {
			down = false;
			if (event.pointerType !== 'mouse') pointer_inside = false;
		};
		const onLeave = () => {
			down = false;
			pointer_inside = false;
		};
		const onVisibility = () => (document.hidden ? stop() : start());
		const onContextLost = (event: Event) => {
			event.preventDefault();
			stop();
		};
		const resize_observer = new ResizeObserver(() => calm.matches && draw(performance.now()));

		canvas.addEventListener('pointermove', onMove);
		canvas.addEventListener('pointerdown', onDown);
		canvas.addEventListener('webglcontextlost', onContextLost);
		window.addEventListener('pointerup', onUp);
		canvas.addEventListener('pointerleave', onLeave);
		document.addEventListener('visibilitychange', onVisibility);
		calm.addEventListener('change', start);
		resize_observer.observe(canvas);
		/* Android e afins entregam sem pedir; no iPhone só depois do toque (askPermission). */
		const needs_permission = typeof (window.DeviceOrientationEvent as unknown as TPermissionEvent | undefined)?.requestPermission === 'function';
		if (coarse && !needs_permission) window.addEventListener('deviceorientation', onOrientation);
		start();

		return () => {
			stop();
			canvas.removeEventListener('pointermove', onMove);
			canvas.removeEventListener('pointerdown', onDown);
			canvas.removeEventListener('webglcontextlost', onContextLost);
			window.removeEventListener('pointerup', onUp);
			canvas.removeEventListener('pointerleave', onLeave);
			document.removeEventListener('visibilitychange', onVisibility);
			calm.removeEventListener('change', start);
			window.removeEventListener('deviceorientation', onOrientation);
			resize_observer.disconnect();
			/*
			 * Sem `loseContext()` aqui: o canvas devolve SEMPRE o mesmo contexto, e em dev o StrictMode monta duas vezes —
			 * a segunda montagem pegava o contexto já perdido e o fundo ficava em branco. Libera só o programa.
			 */
			gl.deleteProgram(program);
			gl.deleteShader(vertex);
			gl.deleteShader(fragment);
		};
	}, [ markRef ]);

	return (
		<canvas
			ref={canvas_ref}
			aria-hidden='true'
			className={cn('absolute inset-0 block h-full w-full touch-pan-y', className)}
		/>
	);
};

export default LiquidBrand;
