import { AppUpdate, AppUpdateAvailability, AppUpdateResultCode } from '@capawesome/capacitor-app-update';

import { is_native } from '@/services/native';

/*
 * Atualização do app nativo (Capacitor). Duas fontes, com papéis diferentes:
 * - A Play Store (In-App Updates API, via @capawesome/capacitor-app-update) diz se EXISTE versão
 *   nova — só funciona com o app instalado pela loja (num APK via adb ela responde "sem update").
 * - O `app-version.json` publicado junto com o site (apps/web/public, servido pela Vercel) diz a
 *   versão MÍNIMA aceita. Suba `min_version_code` quando uma versão antiga deixar de funcionar
 *   (ex.: mudança incompatível no backend) — quem estiver abaixo vê um aviso que não fecha.
 * No navegador nada disso roda: o site já é sempre a versão mais nova.
 */

export type TAppUpdateStatus =
	| { kind: 'none' }
	| { kind: 'available'; version_code: string; current_version?: string }
	| { kind: 'required'; version_code?: string; current_version?: string };

type TVersionPolicy = { android?: { min_version_code?: number } };

const VERSION_POLICY_URL = import.meta.env.VITE_WEB_URL
	? `${ import.meta.env.VITE_WEB_URL.replace(/\/$/, '') }/app-version.json`
	: null;

/* Falha "aberta": sem URL configurada ou sem rede, ninguém é bloqueado. */
const fetchMinVersionCode = async(): Promise<number | null> => {
	if (!VERSION_POLICY_URL) return null;
	try {
		const response = await fetch(VERSION_POLICY_URL, { cache: 'no-store' });
		if (!response.ok) return null;
		const policy = await response.json() as TVersionPolicy;
		return policy.android?.min_version_code ?? null;
	} catch {
		return null;
	}
};

export const AppUpdateService = {
	check: async(): Promise<TAppUpdateStatus> => {
		if (!is_native) return { kind: 'none' };

		const [ info, min_version_code ] = await Promise.all([
			AppUpdate.getAppUpdateInfo().catch(() => null),
			fetchMinVersionCode(),
		]);
		if (!info) return { kind: 'none' };

		const available = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
			? info.availableVersionCode
			: undefined;

		if (min_version_code !== null && Number(info.currentVersionCode) < min_version_code) {
			return { kind: 'required', version_code: available, current_version: info.currentVersionName };
		}
		if (available) return { kind: 'available', version_code: available, current_version: info.currentVersionName };
		return { kind: 'none' };
	},

	/*
	 * Tenta a atualização "imediata" da Play (tela da própria loja por cima do app, que reinicia já
	 * atualizado). Se a Play não permitir (ou recusar), abre a página do app na loja.
	 */
	update: async() => {
		try {
			const info = await AppUpdate.getAppUpdateInfo();
			if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && info.immediateUpdateAllowed) {
				const result = await AppUpdate.performImmediateUpdate();
				if (result.code === AppUpdateResultCode.OK || result.code === AppUpdateResultCode.CANCELED) return;
			}
		} catch {
			/* cai pra loja */
		}
		await AppUpdate.openAppStore().catch(() => {});
	},
};
