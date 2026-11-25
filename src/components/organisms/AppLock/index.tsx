import { useCallback, useEffect, useRef, useState } from 'react';

import { App } from '@capacitor/app';
import { Fingerprint } from 'lucide-react';

import useAppLockSettings from '@/hooks/useAppLockSettings';

import { useCurrentUserContext } from '@/context/current_user';
import { AppLockBiometric, AppLockStore } from '@/services/app-lock';
import { is_native } from '@/services/native';
import { AuthStorage } from '@/services/storage';

import Button from '@/components/atoms/Button';
import Logo from '@/components/atoms/Logo';

/* De quanto em quanto tempo confere se passou do limite sem uso. */
const IDLE_CHECK_MS = 10 * 1000;

/*
 * A janela de biometria é outra Activity do Android: abrir e fechar ela dispara `appStateChange` (sai/volta). Logo
 * depois de desbloquear, ignora essas trocas por um instante pra não travar de novo na hora.
 */
const AFTER_UNLOCK_GRACE_MS = 1500;

/* Toque, tecla ou rolagem contam como "em uso" pro bloqueio por inatividade. */
const ACTIVITY_EVENTS = [ 'pointerdown', 'keydown', 'wheel', 'touchmove' ] as const;

/**
 * Trava do app (só no app da loja, só com a opção ligada em Configurações → Segurança, só com sessão aberta).
 *   - Ao abrir o app: já nasce travada, antes de qualquer tela logada aparecer.
 *   - Ao voltar pro app depois de `background_seconds` em segundo plano.
 *   - Depois de `idle_minutes` sem uso com o app aberto (`null` = nunca).
 * Pede a biometria sozinha ao travar; se a pessoa cancelar, fica o botão "Desbloquear". "Entrar de outro jeito"
 * sai da conta (e desliga a trava), pra ninguém ficar preso se a digital mudar ou falhar.
 */
const AppLock = () => {
	const { is_authenticated, logout } = useCurrentUserContext();
	const { settings, update } = useAppLockSettings();
	const active = is_native && settings.enabled && is_authenticated;

	const [ locked, setLocked ] = useState(() => is_native && AppLockStore.get().enabled && Boolean(AuthStorage.getToken()));
	const [ prompting, setPrompting ] = useState(false);
	const is_locked = active && locked;

	const prompting_ref = useRef(false);
	const app_active_ref = useRef(true);
	const hidden_at_ref = useRef<number | null>(null);
	const last_activity_ref = useRef(Date.now());
	const ignore_until_ref = useRef(0);
	const background_ms_ref = useRef(settings.background_seconds * 1000);
	background_ms_ref.current = settings.background_seconds * 1000;

	useEffect(() => {
		AppLockStore.setLocked(is_locked);
	}, [ is_locked ]);

	/* Saiu da conta (botão, 401, exclusão): destrava e desliga — a próxima pessoa a entrar escolhe de novo. */
	const was_authenticated_ref = useRef(is_authenticated);
	useEffect(() => {
		if (was_authenticated_ref.current && !is_authenticated) {
			setLocked(false);
			if (AppLockStore.get().enabled) update({ enabled: false });
		}
		was_authenticated_ref.current = is_authenticated;
	}, [ is_authenticated, update ]);

	const unlock = useCallback(async() => {
		if (prompting_ref.current) return;
		prompting_ref.current = true;
		setPrompting(true);
		const ok = await AppLockBiometric.verify();
		prompting_ref.current = false;
		setPrompting(false);
		ignore_until_ref.current = Date.now() + AFTER_UNLOCK_GRACE_MS;
		if (!ok) return;
		hidden_at_ref.current = null;
		last_activity_ref.current = Date.now();
		setLocked(false);
	}, []);

	/* Travou (ao abrir, ao voltar ou por inatividade): já abre a biometria, sem esperar o toque no botão. */
	useEffect(() => {
		if (is_locked && app_active_ref.current) unlock();
	}, [ is_locked, unlock ]);

	/* Segundo plano: anota quando saiu; ao voltar, trava se ficou fora tempo demais (ou pede de novo, se já travada). */
	useEffect(() => {
		if (!active) return;
		const listener = App.addListener('appStateChange', ({ isActive }) => {
			app_active_ref.current = isActive;
			if (prompting_ref.current || Date.now() < ignore_until_ref.current) return;

			if (!isActive) {
				hidden_at_ref.current = Date.now();
				return;
			}

			const hidden_at = hidden_at_ref.current;
			hidden_at_ref.current = null;
			if (AppLockStore.isLocked()) {
				unlock();
				return;
			}
			if (hidden_at !== null && Date.now() - hidden_at >= background_ms_ref.current) setLocked(true);
			/* Voltou dentro do prazo: o tempo fora não conta como "sem uso". */
			else last_activity_ref.current = Date.now();
		});
		return () => {
			listener.then((handle) => handle.remove());
		};
	}, [ active, unlock ]);

	/* Inatividade com o app aberto. */
	const idle_minutes = settings.idle_minutes;
	useEffect(() => {
		if (!active || idle_minutes === null) return;
		const limit_ms = idle_minutes * 60 * 1000;
		const mark = () => {
			last_activity_ref.current = Date.now();
		};
		mark();
		ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, mark, { capture: true, passive: true }));
		const timer = window.setInterval(() => {
			if (!app_active_ref.current || prompting_ref.current || AppLockStore.isLocked()) return;
			if (Date.now() - last_activity_ref.current >= limit_ms) setLocked(true);
		}, IDLE_CHECK_MS);
		return () => {
			ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, mark, { capture: true }));
			window.clearInterval(timer);
		};
	}, [ active, idle_minutes ]);

	if (!is_locked) return null;

	return (
		/*
		 * Por cima de tudo, inclusive janelas do Radix (z-50) e da folha do menu. `pointer-events-auto`: com um modal
		 * do Radix aberto por baixo, o <body> fica com `pointer-events: none` e os botões daqui não receberiam o toque.
		 */
		<div
			role='dialog'
			aria-modal='true'
			aria-label='MyFinance bloqueado'
			className='pointer-events-auto fixed inset-0 z-[1000] flex flex-col items-center justify-between bg-background px-6 pb-safe pt-safe'
		>
			<div aria-hidden='true' className='pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(163,188,116,0.22)_0%,rgba(163,188,116,0)_70%)]' />
			<div className='relative flex flex-1 flex-col items-center justify-center gap-5 text-center'>
				<Logo variant='icon' size={56} />
				<div className='flex flex-col gap-1.5'>
					<h1 className='text-2xl font-bold tracking-[-0.03em]'>MyFinance bloqueado</h1>
					<p className='max-w-[280px] text-sm text-muted-foreground'>Use a digital, o rosto ou o bloqueio de tela do aparelho para continuar.</p>
				</div>
			</div>
			<div className='relative flex w-full max-w-sm flex-col items-center gap-3 pb-8'>
				<Button type='button' size='lg' onClick={unlock} isLoading={prompting} className='h-14 w-full gap-2 text-base font-bold'>
					<Fingerprint className='size-5' />Desbloquear
				</Button>
				<button type='button' onClick={logout} className='pressable h-11 px-4 text-sm font-semibold text-muted-foreground'>
					Entrar de outro jeito
				</button>
			</div>
		</div>
	);
};

export default AppLock;
