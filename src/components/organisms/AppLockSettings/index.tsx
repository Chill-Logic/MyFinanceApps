import { useEffect, useState } from 'react';

import useAppLockSettings from '@/hooks/useAppLockSettings';
import useToast from '@/hooks/useToast';

import { AppLockBiometric, type TAppLockAvailability, type TAppLockSettings } from '@/services/app-lock';

import SegmentedControl, { type TSegment } from '@/components/molecules/SegmentedControl';
import { SETTINGS_CARD } from '@/components/organisms/AccountInfoForm';
import Switch from '@/components/ui/switch';

const IDLE_SEGMENTS: TSegment[] = [
	{ value: 'never', label: 'Nunca' },
	{ value: '1', label: '1 min' },
	{ value: '5', label: '5 min' },
	{ value: '15', label: '15 min' },
];

const BACKGROUND_SEGMENTS: TSegment[] = [
	{ value: '0', label: 'Na hora' },
	{ value: '30', label: '30 s' },
	{ value: '60', label: '1 min' },
	{ value: '300', label: '5 min' },
];

/* Resumo de uma linha, pro menu das Configurações. */
export const appLockSummary = (settings: TAppLockSettings) => (settings.enabled ? 'Ligado' : 'Desligado');

/**
 * Configurações → Segurança (só no app da loja): liga a trava com a biometria do aparelho e escolhe quando ela
 * volta — depois de um tempo sem uso com o app aberto e ao voltar pro app depois de um tempo fora.
 * Ligar pede a biometria uma vez, pra confirmar que funciona antes de salvar.
 */
const AppLockSettings = () => {
	const { toast } = useToast();
	const { settings, update } = useAppLockSettings();
	const [ availability, setAvailability ] = useState<TAppLockAvailability | null>(null);
	const [ confirming, setConfirming ] = useState(false);

	useEffect(() => {
		let cancelled = false;
		AppLockBiometric.isAvailable().then((result) => {
			if (!cancelled) setAvailability(result);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const unavailable = availability !== null && !availability.available;

	const toggle = async(next: boolean) => {
		if (!next) {
			update({ enabled: false });
			return;
		}
		setConfirming(true);
		const ok = await AppLockBiometric.verify('Ligar o bloqueio do app');
		setConfirming(false);
		if (!ok) {
			toast.error('Não foi possível confirmar a sua identidade. O bloqueio continua desligado.');
			return;
		}
		update({ enabled: true });
		toast.success('Bloqueio ligado');
	};

	return (
		<section className={SETTINGS_CARD}>
			<div className='flex items-start justify-between gap-4'>
				<div className='flex flex-col gap-0.5'>
					<h3 className='text-lg font-bold'>Bloqueio do app</h3>
					<p className='text-sm text-muted-foreground'>
						{unavailable
							? 'Cadastre uma digital, o rosto ou um bloqueio de tela no Android para usar.'
							: 'Pede a digital, o rosto ou o bloqueio de tela do aparelho ao abrir o MyFinance.'}
					</p>
				</div>
				<Switch
					checked={settings.enabled}
					onCheckedChange={toggle}
					disabled={confirming || availability === null || (unavailable && !settings.enabled)}
					aria-label='Bloqueio do app'
				/>
			</div>

			{settings.enabled && (
				<>
					<div className='flex flex-col gap-2'>
						<div className='flex flex-col gap-0.5'>
							<span className='text-sm font-semibold'>Bloquear sem uso</span>
							<span className='text-xs text-muted-foreground'>Com o app aberto, depois de tanto tempo sem tocar na tela.</span>
						</div>
						<SegmentedControl
							segments={IDLE_SEGMENTS}
							value={settings.idle_minutes === null ? 'never' : String(settings.idle_minutes)}
							onChange={(value) => update({ idle_minutes: value === 'never' ? null : Number(value) })}
						/>
					</div>
					<div className='flex flex-col gap-2'>
						<div className='flex flex-col gap-0.5'>
							<span className='text-sm font-semibold'>Bloquear ao voltar</span>
							<span className='text-xs text-muted-foreground'>Quando o app fica em segundo plano por pelo menos esse tempo.</span>
						</div>
						<SegmentedControl
							segments={BACKGROUND_SEGMENTS}
							value={String(settings.background_seconds)}
							onChange={(value) => update({ background_seconds: Number(value) })}
						/>
					</div>
				</>
			)}
		</section>
	);
};

export default AppLockSettings;
