import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/context/theme';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import AboutInfo from '@/components/organisms/AboutInfo';

/**
 * Configurações do app (não mais da carteira — renomear/convidar/excluir carteira vivem no menu de
 * ações ⋮ de cada carteira, na WalletList). Aqui ficam preferências de verdade: aparência (tema) e
 * o "Sobre" (versões do webapp + API).
 */
const SettingsPage = () => {
	const { theme, toggleTheme } = useTheme();

	return (
		<div className='flex max-w-2xl flex-col gap-6'>
			<Typography variant='large' className='dark:text-white'>
				Configurações
			</Typography>

			<section className='flex flex-col gap-2'>
				<Typography className='text-sm font-medium text-foreground'>Aparência</Typography>
				<div className='flex items-center justify-between gap-3 rounded-lg border border-border p-4'>
					<div className='min-w-0'>
						<p className='text-sm font-medium text-foreground'>Tema</p>
						<p className='text-xs text-muted-foreground'>{theme === 'dark' ? 'Escuro' : 'Claro'}</p>
					</div>
					<Button type='button' variant='outline' className='gap-2' onClick={toggleTheme}>
						{theme === 'dark' ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
						Alternar tema
					</Button>
				</div>
			</section>

			<section className='flex flex-col gap-2'>
				<Typography className='text-sm font-medium text-foreground'>Sobre</Typography>
				<div className='rounded-lg border border-border p-4'>
					<AboutInfo />
				</div>
			</section>
		</div>
	);
};

export default SettingsPage;
