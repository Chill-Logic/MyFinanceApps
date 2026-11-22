import { useEffect, useState } from 'react';

import { App } from '@capacitor/app';

import { useVersion } from '@/hooks/api/core/useVersion';

import { cn } from '@/lib/utils';
import { is_native } from '@/services/native';

/*
 * Prefixo de versão ("0.3") = major.minor do `version` do package.json do web. É a fonte única: o CD do Android
 * (`android-cd.yml`) lê o mesmo campo pra montar o versionName do app ("0.3.<versionCode>"). Suba ali em marcos.
 */
const VERSION_PREFIX = __APP_VERSION__.split('.').slice(0, 2).join('.');

const pad = (value: number) => String(value).padStart(2, '0');

/* Data/hora do build (ISO gravado pelo Vite) no fuso de quem olha: "22/11/2026 02:56". */
const formatBuildDate = (iso: string, short = false) => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '—';
	const day = `${ pad(date.getDate()) }/${ pad(date.getMonth() + 1) }`;
	return short ? day : `${ day }/${ date.getFullYear() } ${ pad(date.getHours()) }:${ pad(date.getMinutes()) }`;
};

/**
 * "20/11 18:42" a partir do formato do Rails ("2026-07-11 19:12:03 -0300") — só regex, sem `new Date()` (o
 * formato do Rails não é parseável de forma confiável e aqui só interessa exibir o que veio).
 */
const formatApiDate = (raw?: string) => {
	if (!raw || raw === 'unknown') return raw ?? '—';
	const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
	if (!match) return raw;
	const [ , , month, day, hour, minute ] = match;
	return `${ day }/${ month } ${ hour }:${ minute }`;
};

const shortHash = (hash?: string) => (hash ? hash.slice(0, 7) : '…');

/*
 * Versão do que está rodando. No app da loja: o versionName/versionCode do Android (`@capacitor/app`), o mesmo
 * número que a Play mostra (ex.: 0.3.105, build 105). No navegador: o prefixo + a data do build — o webapp não
 * tem número próprio (a Vercel publica a cada merge).
 */
export const useAppVersion = () => {
	const [ native, setNative ] = useState<{ version: string; build: string } | null>(null);

	useEffect(() => {
		if (!is_native) return;
		App.getInfo().then(({ version, build }) => setNative({ version, build })).catch(() => undefined);
	}, []);

	if (is_native) {
		return {
			label: 'App',
			version: native?.version ?? '…',
			short: native?.version ?? '…',
			detail: native ? `build ${ native.build } · ${ formatBuildDate(__APP_BUILD_DATE__) }` : formatBuildDate(__APP_BUILD_DATE__),
		};
	}
	return {
		label: 'Webapp',
		version: VERSION_PREFIX,
		short: `${ VERSION_PREFIX } (${ formatBuildDate(__APP_BUILD_DATE__, true) })`,
		detail: formatBuildDate(__APP_BUILD_DATE__),
	};
};

/* Versão curta do app/webapp e commit da API (linha "Sobre" do celular). */
export const useShortVersions = () => {
	const app = useAppVersion();
	const { data: api_version } = useVersion();
	return { label: app.label, app: app.short, api: shortHash(api_version?.hash) };
};

/**
 * Versão do app/webapp e da API (GET /core/version — a API não tem número de versão, só branch, commit e data).
 * `inline` = uma linha só (tablet em pé); senão, dois blocos.
 */
const AboutInfo = ({ inline = false, className }: { inline?: boolean; className?: string }) => {
	const app = useAppVersion();
	const { data: api_version } = useVersion();

	const block = (label: string, main: string, detail: string) => (
		<span className={cn('flex text-sm text-muted-foreground', inline ? 'items-baseline gap-1.5' : 'flex-col gap-0.5')}>
			<span className={cn(!inline && 'text-xs font-semibold uppercase tracking-wide')}>{label}</span>
			<span>
				<span className='font-mono font-semibold text-foreground'>{main}</span>
				<span> · {detail}</span>
			</span>
		</span>
	);

	return (
		<div className={cn('flex gap-6', inline ? 'flex-wrap items-center justify-end' : 'flex-col', className)}>
			{block(app.label, app.version, app.detail)}
			{block('API', `${ api_version?.branch ?? '…' } · ${ shortHash(api_version?.hash) }`, formatApiDate(api_version?.date))}
		</div>
	);
};

export default AboutInfo;
