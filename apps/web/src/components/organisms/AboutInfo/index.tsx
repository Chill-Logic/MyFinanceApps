import { useVersion } from '@/hooks/api/core/useVersion';

import { cn } from '@/lib/utils';

/**
 * "20/11 18:42" a partir do formato do Rails ("2026-07-11 19:12:03 -0300") ou do ISO do git — só regex, sem
 * `new Date()` (o formato do Rails não é parseável de forma confiável e aqui só interessa exibir o que veio).
 */
const formatVersionDate = (raw?: string) => {
	if (!raw || raw === 'unknown') return raw ?? '—';
	const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
	if (!match) return raw;
	const [ , , month, day, hour, minute ] = match;
	return `${ day }/${ month } ${ hour }:${ minute }`;
};

const shortHash = (hash?: string) => (hash ? hash.slice(0, 7) : '…');

/* Commits curtos do webapp e da API (linha "Sobre" do celular). */
export const useShortVersions = () => {
	const { data: api_version } = useVersion();
	return { web: shortHash(__APP_GIT_COMMIT__), api: shortHash(api_version?.hash) };
};

/**
 * Versões do webapp (globais do Vite, do git no build) e da API (GET /core/version): branch, commit e data.
 * `inline` = uma linha só (tablet em pé); senão, dois blocos.
 */
const AboutInfo = ({ inline = false, className }: { inline?: boolean; className?: string }) => {
	const { data: api_version } = useVersion();

	const block = (label: string, branch?: string, hash?: string, date?: string) => (
		<span className={cn('flex text-sm text-muted-foreground', inline ? 'items-baseline gap-1.5' : 'flex-col gap-0.5')}>
			<span className={cn(!inline && 'text-xs font-semibold uppercase tracking-wide')}>{label}</span>
			<span>
				<span className='font-mono font-semibold text-foreground'>{branch ?? '…'} · {shortHash(hash)}</span>
				<span> · {formatVersionDate(date)}</span>
			</span>
		</span>
	);

	return (
		<div className={cn('flex gap-6', inline ? 'flex-wrap items-center justify-end' : 'flex-col', className)}>
			{block('Webapp', __APP_GIT_BRANCH__, __APP_GIT_COMMIT__, __APP_GIT_DATE__)}
			{block('API', api_version?.branch, api_version?.hash, api_version?.date)}
		</div>
	);
};

export default AboutInfo;
