import { useState } from 'react';

import { ChevronDown, ChevronLeft, ChevronRight, Info, Lock, Moon, Palette, Pencil, Sun, User, type LucideIcon } from 'lucide-react';

import { useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';

import Button from '@/components/atoms/Button';
import Typography from '@/components/atoms/Typography';
import AboutInfo from '@/components/organisms/AboutInfo';
import AccountInfoForm from '@/components/organisms/AccountInfoForm';
import AccountPasswordForm from '@/components/organisms/AccountPasswordForm';

type TLeafKey = 'appearance' | 'about' | 'account_info' | 'account_password';

type TLeaf = {
	type: 'leaf';
	key: TLeafKey;
	label: string;
	description: string;
	icon: LucideIcon;
};

type TGroup = {
	type: 'group';
	key: string;
	label: string;
	description: string;
	icon: LucideIcon;
	children: TLeaf[];
};

const NODES: (TLeaf | TGroup)[] = [
	{ type: 'leaf', key: 'appearance', label: 'Aparência', description: 'Tema claro ou escuro', icon: Palette },
	{
		type: 'group',
		key: 'account',
		label: 'Conta',
		description: 'Seus dados e senha',
		icon: User,
		children: [
			{ type: 'leaf', key: 'account_info', label: 'Informações pessoais', description: 'Nome e e-mail', icon: Pencil },
			{ type: 'leaf', key: 'account_password', label: 'Atualizar senha', description: 'Trocar sua senha', icon: Lock },
		],
	},
	{ type: 'leaf', key: 'about', label: 'Sobre', description: 'Versões do webapp e da API', icon: Info },
];

const LEAVES: TLeaf[] = NODES.flatMap((node) => (node.type === 'group' ? node.children : [ node ]));

const leaf_base = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors';

/**
 * Configurações em árvore mestre-detalhe ("diretórios"): lista com folhas e grupos expansíveis à
 * esquerda, conteúdo da folha selecionada à direita. O grupo "Conta" abre em "Informações pessoais"
 * e "Atualizar senha", cada um com seu form no detalhe. Responsivo só com CSS+estado: desktop lado a
 * lado (1ª folha ativa por padrão); mobile drill-in (a lista some ao abrir uma folha, volta pelo
 * "Voltar"; tocar num grupo só expande/colapsa, não navega).
 */
const SettingsPage = () => {
	const { theme, toggleTheme } = useTheme();

	const [ selected_key, setSelectedKey ] = useState<TLeafKey | null>(null);
	const [ expanded, setExpanded ] = useState<Record<string, boolean>>({ account: true });

	const active_key = selected_key ?? LEAVES[0].key;
	const active_leaf = LEAVES.find((leaf) => leaf.key === active_key)!;
	const active_group = NODES.find(
		(node): node is TGroup => node.type === 'group' && node.children.some((child) => child.key === active_key),
	);

	const toggleGroup = (key: string) => {
		setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const renderLeafButton = (leaf: TLeaf, indented = false) => (
		<button
			key={leaf.key}
			type='button'
			onClick={() => setSelectedKey(leaf.key)}
			className={cn(
				leaf_base,
				indented && 'pl-9',
				active_key === leaf.key ? 'bg-secondary font-medium text-secondary-foreground' : 'text-foreground hover:bg-muted',
			)}
		>
			<leaf.icon className='h-4 w-4 shrink-0' />
			<span className='min-w-0 flex-1'>
				<span className='block truncate'>{leaf.label}</span>
				<span className='block truncate text-xs text-muted-foreground'>{leaf.description}</span>
			</span>
			<ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground md:hidden' />
		</button>
	);

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

		if (active_key === 'about') {
			return (
				<div className='rounded-lg border border-border p-4'>
					<AboutInfo />
				</div>
			);
		}

		if (active_key === 'account_info') return <AccountInfoForm />;

		return <AccountPasswordForm />;
	};

	return (
		<div className='flex flex-col gap-4'>
			<Typography variant='large' className='dark:text-white'>
				Configurações
			</Typography>

			<div className='flex flex-col gap-4 md:flex-row md:items-start'>
				{/* Lista (mestre): some no mobile quando um detalhe está aberto; sempre visível no desktop. */}
				<nav
					className={cn(
						'w-full flex-col gap-1 md:flex md:w-64 md:shrink-0 md:border-r md:border-border md:pr-2',
						selected_key ? 'hidden' : 'flex',
					)}
				>
					{NODES.map((node) => {
						if (node.type === 'leaf') return renderLeafButton(node);

						const is_open = expanded[node.key];

						return (
							<div key={node.key} className='flex flex-col gap-1'>
								<button
									type='button'
									onClick={() => toggleGroup(node.key)}
									className={cn(leaf_base, 'text-foreground hover:bg-muted')}
								>
									<node.icon className='h-4 w-4 shrink-0' />
									<span className='min-w-0 flex-1'>
										<span className='block truncate'>{node.label}</span>
										<span className='block truncate text-xs text-muted-foreground'>{node.description}</span>
									</span>
									<ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', is_open && 'rotate-180')} />
								</button>

								{is_open && node.children.map((child) => renderLeafButton(child, true))}
							</div>
						);
					})}
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

					<div className='flex flex-col gap-0.5'>
						{active_group && <span className='text-xs text-muted-foreground'>{active_group.label}</span>}
						<Typography className='text-base font-semibold text-foreground'>{active_leaf.label}</Typography>
					</div>

					{renderDetail()}
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
