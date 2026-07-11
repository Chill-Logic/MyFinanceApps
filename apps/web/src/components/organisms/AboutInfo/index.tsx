import { useVersion } from '@/hooks/api/core/useVersion';

/**
 * Bloco "Sobre": versão do app (build do front, via __APP_VERSION__) + versão do backend em
 * execução (branch/commit/data, de GET /core/version). Reutilizado nas Configurações e no item
 * "Sobre" do menu (Sidebar/NavMenu). Sem heading próprio — quem usa decide o rótulo/título.
 */
const AboutInfo = () => {
	const { data: version } = useVersion();

	return (
		<div className='flex flex-col gap-0.5'>
			<p className='text-xs text-muted-foreground'>App: v{__APP_VERSION__}</p>
			{version ? (
				<>
					<p className='text-xs text-muted-foreground'>Branch: {version.branch}</p>
					<p className='text-xs text-muted-foreground'>Commit: {version.hash}</p>
					<p className='text-xs text-muted-foreground'>Data: {version.date}</p>
				</>
			) : (
				<p className='text-xs text-muted-foreground'>Carregando versão da API…</p>
			)}
		</div>
	);
};

export default AboutInfo;
