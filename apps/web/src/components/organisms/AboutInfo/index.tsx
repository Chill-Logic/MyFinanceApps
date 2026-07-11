import { useVersion } from '@/hooks/api/core/useVersion';

/**
 * Normaliza a data do commit pra "DD/MM/AAAA às HH:MM". Cobre tanto o formato do Rails
 * ("2026-07-11 19:12:03 -0300") quanto o ISO do git ("2026-07-11T19:12:03-03:00") só extraindo os
 * campos com regex — sem passar por `new Date()` (o formato do Rails não é parseável de forma
 * confiável entre browsers, e aqui só interessa exibir o que veio, não fazer conta de fuso).
 */
const formatVersionDate = (raw?: string) => {
	if (!raw || raw === 'unknown') return raw ?? '—';

	const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
	if (!match) return raw;

	const [ , year, month, day, hour, minute ] = match;
	return `${ day }/${ month }/${ year } às ${ hour }:${ minute }`;
};

const line_class = 'text-xs text-muted-foreground';

/**
 * Bloco "Sobre": versões do webapp E da API, cada uma com branch/commit/data. O webapp lê de
 * globais injetadas pelo Vite em build (git); a API vem de GET /core/version. Usado na seção
 * "Sobre" da página de Configurações.
 */
const AboutInfo = () => {
	const { data: api_version } = useVersion();

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-col gap-0.5'>
				<p className='text-xs font-semibold text-foreground'>Webapp</p>
				<p className={line_class}>Branch: {__APP_GIT_BRANCH__}</p>
				<p className={line_class}>Commit: {__APP_GIT_COMMIT__}</p>
				<p className={line_class}>Data: {formatVersionDate(__APP_GIT_DATE__)}</p>
			</div>

			<div className='flex flex-col gap-0.5'>
				<p className='text-xs font-semibold text-foreground'>API</p>
				{api_version ? (
					<>
						<p className={line_class}>Branch: {api_version.branch}</p>
						<p className={line_class}>Commit: {api_version.hash}</p>
						<p className={line_class}>Data: {formatVersionDate(api_version.date)}</p>
					</>
				) : (
					<p className={line_class}>Carregando…</p>
				)}
			</div>
		</div>
	);
};

export default AboutInfo;
