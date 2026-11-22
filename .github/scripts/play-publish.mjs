#!/usr/bin/env node
/*
 * Publicação do app Android (Capacitor) na Google Play pela Android Publisher API, sem dependências
 * (só módulos do Node 22). Usado pelo android-cd.yml, mas roda local igual.
 *
 * Credencial: PLAY_SERVICE_ACCOUNT_FILE = caminho do JSON da service account (a mesma do antigo EAS
 * Submit, com permissão só pras faixas de teste).
 *
 *   node .github/scripts/play-publish.mjs next-version-code <package>
 *     → imprime o maior versionCode já enviado à Play (qualquer faixa ou bundle) + 1.
 *   node .github/scripts/play-publish.mjs upload <package> <app.aab> <track> <nome da versão> [notas]
 *     → sobe o AAB e publica (status completed) na faixa indicada (ex.: internal).
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';

const fail = (message) => {
	console.error(message);
	process.exit(1);
};

const accessToken = async () => {
	const file = process.env.PLAY_SERVICE_ACCOUNT_FILE;
	if (!file) fail('Defina PLAY_SERVICE_ACCOUNT_FILE com o caminho do JSON da service account.');
	const sa = JSON.parse(readFileSync(file, 'utf8'));
	const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
		iss: sa.client_email,
		scope: 'https://www.googleapis.com/auth/androidpublisher',
		aud: sa.token_uri,
		iat: now,
		exp: now + 3600,
	})}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
	const token = await call('token', sa.token_uri, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
	});
	return token.access_token;
};

async function call(step, url, init) {
	const res = await fetch(url, init);
	const text = await res.text();
	if (!res.ok) fail(`${step} falhou (${res.status}): ${text}`);
	return text ? JSON.parse(text) : {};
}

/* Toda leitura/escrita na Play acontece dentro de um "edit"; sem commit, nada muda. */
const withEdit = async (pkg, fn, { commit }) => {
	const auth = { Authorization: `Bearer ${await accessToken()}` };
	const edit = await call('criar edit', `${API}/${pkg}/edits`, { method: 'POST', headers: auth });
	const base = `${API}/${pkg}/edits/${edit.id}`;
	try {
		const result = await fn({ auth, base, upload_base: `${UPLOAD_API}/${pkg}/edits/${edit.id}` });
		if (commit) await call('commit', `${base}:commit`, { method: 'POST', headers: auth });
		return result;
	} finally {
		if (!commit) await fetch(base, { method: 'DELETE', headers: auth }).catch(() => {});
	}
};

const nextVersionCode = (pkg) => withEdit(pkg, async ({ auth, base }) => {
	const [ tracks, bundles ] = await Promise.all([
		call('listar faixas', `${base}/tracks`, { headers: auth }),
		call('listar bundles', `${base}/bundles`, { headers: auth }),
	]);
	const codes = [
		...(tracks.tracks ?? []).flatMap((t) => (t.releases ?? []).flatMap((r) => r.versionCodes ?? [])),
		...(bundles.bundles ?? []).map((b) => b.versionCode),
	].map(Number).filter(Number.isFinite);
	return Math.max(0, ...codes) + 1;
}, { commit: false });

const upload = (pkg, aab, track, name, notes) => withEdit(pkg, async ({ auth, base, upload_base }) => {
	const bundle = await call('upload do AAB', `${upload_base}/bundles?uploadType=media`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/octet-stream' },
		body: readFileSync(aab),
	});
	console.log(`AAB enviado: versionCode ${bundle.versionCode}`);
	await call(`publicar na faixa ${track}`, `${base}/tracks/${track}`, {
		method: 'PUT',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			track,
			releases: [ {
				name,
				versionCodes: [ String(bundle.versionCode) ],
				status: 'completed',
				...(notes ? { releaseNotes: [ { language: 'pt-BR', text: notes.slice(0, 500) } ] } : {}),
			} ],
		}),
	});
	console.log(`Publicado na faixa ${track}: ${name}`);
}, { commit: true });

const [ command, ...args ] = process.argv.slice(2);
if (command === 'next-version-code' && args[0]) {
	console.log(await nextVersionCode(args[0]));
} else if (command === 'upload' && args.length >= 4) {
	await upload(...args);
} else {
	fail('Uso: play-publish.mjs next-version-code <package> | upload <package> <aab> <track> <nome> [notas]');
}
