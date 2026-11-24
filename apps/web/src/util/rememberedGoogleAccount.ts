import { jwtDecode } from 'jwt-decode';

/*
 * Última conta do Google usada pra entrar NESTE aparelho/navegador, pra tela de login mostrar "Continuar como
 * <nome>" com a foto. Vem do próprio ID token que o Google devolve (nome, e-mail e foto já estão nele) — nada vai pro
 * backend. Sair da conta NÃO apaga (a ideia é reaparecer no próximo login); "Usar outra conta" e excluir a conta, sim.
 */

export type TRememberedGoogleAccount = { name: string; email: string; picture?: string };

const KEY = 'remembered-google-account';

export const rememberGoogleAccount = (id_token: string) => {
	try {
		const { name, given_name, email, picture } = jwtDecode<{ name?: string; given_name?: string; email?: string; picture?: string }>(id_token);
		if (!email) return;
		const account: TRememberedGoogleAccount = { name: given_name || name || email, email, picture };
		localStorage.setItem(KEY, JSON.stringify(account));
	} catch {
		/* Token estranho ou sem storage: só não lembra. */
	}
};

export const getRememberedGoogleAccount = (): TRememberedGoogleAccount | null => {
	try {
		const raw = localStorage.getItem(KEY);
		const account = raw ? JSON.parse(raw) as TRememberedGoogleAccount : null;
		return account?.email ? account : null;
	} catch {
		return null;
	}
};

export const forgetGoogleAccount = () => {
	try {
		localStorage.removeItem(KEY);
	} catch {
		/* Sem storage: nada a esquecer. */
	}
};
