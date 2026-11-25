import { BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric';

import { is_native } from '@/services/native';

/*
 * Trava do app com a biometria do aparelho (digital, rosto) ou, na falta dela, o PIN/padrão/senha do Android.
 * Versão simples: o token continua onde sempre esteve; a trava só esconde o app até a pessoa se identificar.
 * A preferência é do APARELHO (não vai pro `users.preferences`): cada celular decide se pede ou não.
 */

export type TAppLockSettings = {
	enabled: boolean;
	/* Bloqueia depois de tanto tempo SEM USO com o app aberto. `null` = nunca. */
	idle_minutes: number | null;
	/* Ao voltar pro app, bloqueia se ele ficou em segundo plano por pelo menos isso. `0` = na hora. */
	background_seconds: number;
};

export const DEFAULT_APP_LOCK_SETTINGS: TAppLockSettings = { enabled: false, idle_minutes: 5, background_seconds: 30 };

const STORAGE_KEY = 'app-lock';

const read = (): TAppLockSettings => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_APP_LOCK_SETTINGS;
		const parsed = JSON.parse(raw) as Partial<TAppLockSettings>;
		return {
			enabled: parsed.enabled === true,
			idle_minutes: typeof parsed.idle_minutes === 'number' ? parsed.idle_minutes : null,
			background_seconds: typeof parsed.background_seconds === 'number' ? parsed.background_seconds : DEFAULT_APP_LOCK_SETTINGS.background_seconds,
		};
	} catch {
		return DEFAULT_APP_LOCK_SETTINGS;
	}
};

let settings = read();
const listeners = new Set<()=> void>();

/* Se a tela está travada agora — o voltar do Android consulta isso pra não navegar por trás da trava. */
let locked = false;

export const AppLockStore = {
	get: () => settings,
	subscribe: (listener: ()=> void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	update: (patch: Partial<TAppLockSettings>) => {
		settings = { ...settings, ...patch };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch {
			/* sem storage a escolha vale só até fechar o app */
		}
		listeners.forEach((listener) => listener());
	},
	isLocked: () => locked,
	setLocked: (value: boolean) => {
		locked = value;
	},
};

export type TAppLockAvailability = { available: boolean; biometry: 'fingerprint' | 'face' | 'multiple' | 'device_credential' | 'none' };

const biometryName = (type: BiometryType): TAppLockAvailability['biometry'] => {
	switch (type) {
		case BiometryType.FINGERPRINT:
		case BiometryType.TOUCH_ID:
			return 'fingerprint';
		case BiometryType.FACE_AUTHENTICATION:
		case BiometryType.FACE_ID:
			return 'face';
		case BiometryType.MULTIPLE:
			return 'multiple';
		case BiometryType.DEVICE_CREDENTIAL:
			return 'device_credential';
		default:
			return 'none';
	}
};

/*
 * Biometria fraca (rosto em muitos Android) + PIN/padrão do aparelho como alternativa. Com DEVICE_CREDENTIAL o
 * Android não mostra "Cancelar" (as duas coisas são exclusivas no BiometricPrompt); a pessoa cancela pelo voltar.
 */
const ALLOWED_TYPES = [ BiometryType.MULTIPLE, BiometryType.DEVICE_CREDENTIAL ];

export const AppLockBiometric = {
	isAvailable: async(): Promise<TAppLockAvailability> => {
		if (!is_native) return { available: false, biometry: 'none' };
		try {
			const result = await NativeBiometric.isAvailable({ useFallback: true });
			return { available: result.isAvailable, biometry: biometryName(result.biometryType) };
		} catch {
			return { available: false, biometry: 'none' };
		}
	},

	/* Resolve `true` se a pessoa se identificou; `false` se cancelou ou errou. */
	verify: async(title = 'Desbloquear o MyFinance'): Promise<boolean> => {
		if (!is_native) return true;
		try {
			await NativeBiometric.verifyIdentity({
				title,
				subtitle: 'Use a digital, o rosto ou o bloqueio de tela do aparelho',
				allowedBiometryTypes: ALLOWED_TYPES,
				maxAttempts: 5,
			});
			return true;
		} catch {
			return false;
		}
	},
};
