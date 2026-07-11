import { useState } from 'react';

import { ChevronLeft, ChevronRight, Info, Moon, Palette, Sun, type LucideIcon } from 'lucide-react';

import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import AboutInfo from '@/components/organisms/AboutInfo';

type TSettingKey = 'appearance' | 'about';

type TSettingItem = {
	key: TSettingKey;
	label: string;
	description: string;
	icon: LucideIcon;
};

const SETTINGS: TSettingItem[] = [
	{ key: 'appearance', label: 'Aparência', description: 'Tema claro ou escuro', icon: Palette },
	{ key: 'about', label: 'Sobre', description: 'Versões do webapp e da API', icon: Info },
];

/**
 * Configurações em layout mestre-detalhe ("diretórios"): lista à esquerda, conteúdo da opção
 * selecionada à direita. Responsivo sem `useMediaQuery`, só com CSS + estado: no desktop lista e
 * detalhe convivem (a 1ª opção fica ativa por padrão); no mobile é drill-in — a lista some quando
 * uma opção é aberta e volta pelo "Voltar". `active_key` cai na 1ª opção quando nada foi escolhido
 * (no mobile o detalhe fica escondido nesse caso, então esse default não aparece à toa).
 */
const SettingsPage = () => {
	const { theme, toggleTheme } = useTheme();

	const [ selected_key, setSelectedKey ] = useState<TSettingKey | null>(null);

	const active_key = selected_key ?? SETTINGS[0].key;

	const renderDetail = () => {
		if (active_key === 'appearance') {
			return (
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
			);
		}

		return (
			<div className='rounded-lg border border-border p-4'>
				<AboutInfo />
			</div>
		);
	};

	const active_item = SETTINGS.find((item) => item.key === active_key)!;

	return (
		<div className='flex flex-col gap-4'>
			<Typography variant='large' className='dark:text-white'>
				Configurações
			</Typography>

			<div className='flex flex-col gap-4 md:flex-row md:items-start'>
				{/* Lista (mestre): some no mobile quando um detalhe está aberto; sempre visível no desktop. */}
				<nav
					className={cn(
						'w-full flex-col gap-1 md:flex md:w-56 md:shrink-0 md:border-r md:border-border md:pr-2',
						selected_key ? 'hidden' : 'flex',
					)}
				>
					{SETTINGS.map((item) => (
						<button
							key={item.key}
							type='button'
							onClick={() => setSelectedKey(item.key)}
							className={cn(
								'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
								active_key === item.key ? 'bg-secondary font-medium text-secondary-foreground' : 'text-foreground hover:bg-muted',
							)}
						>
							<item.icon className='h-4 w-4 shrink-0' />
							<span className='min-w-0 flex-1'>
								<span className='block truncate'>{item.label}</span>
								<span className='block truncate text-xs text-muted-foreground'>{item.description}</span>
							</span>
							<ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground md:hidden' />
						</button>
					))}
				</nav>

				{/* Detalhe: escondido no mobile enquanto nada foi selecionado; sempre visível no desktop. */}
				<div className={cn('min-w-0 flex-1 flex-col gap-3 md:flex', selected_key ? 'flex' : 'hidden')}>
					<button
						type='button'
						onClick={() => setSelectedKey(null)}
						className='flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden'
					>
						<ChevronLeft className='h-4 w-4' />
						Voltar
					</button>

					<Typography className='text-base font-semibold text-foreground'>{active_item.label}</Typography>
					{renderDetail()}
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
