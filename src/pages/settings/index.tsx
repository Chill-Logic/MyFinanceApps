import { type ReactNode, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { getApiErrorMessage, MONTH_NAMES_PT, QUERY_KEYS } from '@myfinance/shared';
import { Bot, ChevronLeft, ChevronRight, Info, Landmark, Lock, LogOut, Monitor, Moon, Palette, Star, Sun, Trash2, User, type LucideIcon } from 'lucide-react';

import { useIndexClaudeSessions } from '@/hooks/api/claude-sessions/useIndexClaudeSessions';
import { useUpdateCurrentUser } from '@/hooks/api/user/useUpdateCurrentUser';
import { useGetMainWallet } from '@/hooks/api/wallets/useGetMainWallet';
import { useIndexWallets } from '@/hooks/api/wallets/useIndexWallets';
import useMediaQuery from '@/hooks/useMediaQuery';
import useToast from '@/hooks/useToast';

import { useCurrentUserContext } from '@/context/current_user';
import { type TThemePreference, useTheme } from '@/context/theme';
import { cn } from '@/lib/utils';
import { queryClient } from '@/services/query-client';
import { SECTION_SLUGS } from '@/util/routeSlugs';

import Button from '@/components/atoms/Button';
import LegalLinks from '@/components/molecules/LegalLinks';
import { LiquidBlob, useLiquidBlob } from '@/components/molecules/NavKit';
import SegmentedControl, { type TSegment } from '@/components/molecules/SegmentedControl';
import AboutInfo, { useShortVersions } from '@/components/organisms/AboutInfo';
import AccountInfoForm, { SETTINGS_CARD } from '@/components/organisms/AccountInfoForm';
import AccountPasswordForm from '@/components/organisms/AccountPasswordForm';
import ClaudeConnections from '@/components/organisms/ClaudeConnections';
import DeleteAccountDialog from '@/components/organisms/DeleteAccountDialog';
import Badge from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const HERO = 'relative overflow-hidden rounded-3xl border border-sand-light/15 bg-gradient-to-br from-navy-light from-0% to-navy to-65% text-sand-light shadow-[0_18px_40px_rgba(8,36,53,0.22)] dark:shadow-none';
const HERO_GLOW = 'pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(163,188,116,0.30)_0%,rgba(163,188,116,0)_70%)]';
const SURFACE = 'border border-border bg-white shadow-[0_1px_2px_rgba(8,36,53,0.05)] dark:bg-[rgba(199,195,191,0.04)] dark:shadow-none';

const THEME_SEGMENTS: TSegment[] = [
	{ value: 'system', label: 'Sistema', icon: Monitor },
	{ value: 'light', label: 'Claro', icon: Sun },
	{ value: 'dark', label: 'Escuro', icon: Moon },
];

/* Seções do menu (desktop/tablet deitado) e das telas de detalhe (celular/tablet em pé). */
type TSection = 'account' | 'account_info' | 'password' | 'appearance' | 'main_wallet' | 'claude' | 'bank' | 'about';
const SECTIONS: TSection[] = [ 'account', 'account_info', 'password', 'appearance', 'main_wallet', 'claude', 'bank', 'about' ];
const sectionFromSlug = (slug: string | null): TSection | null => SECTIONS.find((key) => SECTION_SLUGS[key] === slug) ?? null;

/*
 * Transições (tailwindcss-animate). Celular/tablet em pé: a tela da seção entra pela direita e, ao voltar, a lista
 * entra pela esquerda — como uma navegação nativa. Desktop: o conteúdo da seção troca com fade + leve subida.
 */
const ENTER_FORWARD = 'animate-in fade-in-0 slide-in-from-right-6 duration-300 ease-out motion-reduce:animate-none';
const ENTER_BACK = 'animate-in fade-in-0 slide-in-from-left-6 duration-300 ease-out motion-reduce:animate-none';
const ENTER_SECTION = 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none';

const initials = (name?: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

/**
 * Configurações (redesign 2026-11, mockup v3).
 *   - Desktop e tablet deitado: menu de seções à esquerda (Conta, Aparência, Carteira principal, Conexões com o
 *     Claude, Integração bancária, Sobre) com um resumo de cada; o conteúdo da seção à direita.
 *   - Tablet em pé: tudo empilhado (perfil, dados e senha lado a lado, aparência e carteira principal, integrações,
 *     sobre); "Conexões com o Claude" abre por dentro.
 *   - Celular: lista agrupada (Conta, Preferências, Integrações) que abre cada item numa tela própria, "Sair da
 *     conta" e a linha "Sobre".
 */
const SettingsContent = () => {
	const { toast } = useToast();
	const is_wide = useMediaQuery('(min-width: 1024px)');
	const is_tablet = useMediaQuery('(min-width: 768px)');
	const { theme, preference, setPreference } = useTheme();
	const { current_user, logout } = useCurrentUserContext();
	const me = current_user.data;
	const { data: wallets_data } = useIndexWallets();
	const { data: main_wallet } = useGetMainWallet({ enabled: Boolean(me?.id), params: { user_id: me?.id || '' } });
	const { mutate: updateCurrentUserMutation, isPending: is_main_pending } = useUpdateCurrentUser();
	const { data: claude_data } = useIndexClaudeSessions();
	const versions = useShortVersions();

	/*
	 * A seção aberta mora na URL (`/configuracoes?secao=senha`), não num state: no celular/tablet em pé, abrir uma
	 * seção EMPILHA uma entrada no histórico, então o gesto/botão voltar (navegador ou Android) fecha a seção e volta
	 * pra lista — antes ele pulava direto pra tela de antes das Configurações. No desktop/tablet deitado, trocar de
	 * seção no menu SUBSTITUI a entrada (é troca de aba, não navegação; senão o voltar desfaria clique por clique).
	 */
	const [ search_params, setSearchParams ] = useSearchParams();
	const [ delete_open, setDeleteOpen ] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	/*
	 * Integração bancária (Pluggy) em testes: quem não foi liberado pelo backend (`pluggy_enabled`) nem vê a seção.
	 * Um link direto pra ela (`?secao=integracao-bancaria`) cai na tela inicial das Configurações.
	 */
	const pluggy_enabled = Boolean(me?.pluggy_enabled);
	const requested_section = sectionFromSlug(search_params.get('secao'));
	const section = requested_section === 'bank' && !pluggy_enabled ? null : requested_section;

	/* Pra onde a última troca foi: decide de que lado a tela entra (nada na primeira renderização). */
	const [ previous_section, setPreviousSection ] = useState(section);
	const [ direction, setDirection ] = useState<'forward' | 'back' | null>(null);
	if (previous_section !== section) {
		/* Estado derivado da URL, ajustado no próprio render — vale também pro voltar do navegador. */
		setPreviousSection(section);
		setDirection(section ? 'forward' : 'back');
	}

	const setSection = (next: TSection | null) => {
		if (next === section) return;
		if (is_wide) {
			setSearchParams(next ? { secao: SECTION_SLUGS[next] } : {}, { replace: true });
			return;
		}
		if (next) {
			setSearchParams({ secao: SECTION_SLUGS[next] }, { state: { settings_section: true } });
			return;
		}
		/* Botão "Voltar" da tela: desempilha a entrada que a seção criou; aberta por link direto, só limpa a URL. */
		if ((location.state as { settings_section?: boolean } | null)?.settings_section) navigate(-1);
		else setSearchParams({}, { replace: true });
	};
	/* No menu do desktop "Informações pessoais" e "Senha" (telas do celular) ficam dentro de "Conta". */
	const active: TSection = section === 'account_info' || section === 'password' ? 'account' : section ?? 'account';

	/* Desktop/tablet deitado: gota de vidro que escorre até o item ativo do menu (mesma peça da barra lateral). */
	const menu_ref = useRef<HTMLElement>(null);
	const menu_blob = useLiquidBlob(is_wide ? active : null, () => menu_ref.current?.querySelector<HTMLElement>(`[data-section="${ active }"]`) ?? null);

	const wallets = wallets_data?.data ?? [];
	const sessions = claude_data?.data ?? [];
	const active_sessions = sessions.filter((session) => session.status === 'active').length;
	const pending_sessions = sessions.filter((session) => session.status === 'pending').length;
	const claude_summary = [
		active_sessions ? `${ active_sessions } ${ active_sessions === 1 ? 'ativa' : 'ativas' }` : null,
		pending_sessions ? `${ pending_sessions } aguardando` : null,
	].filter(Boolean).join(' · ') || (sessions.length ? 'nenhuma ativa' : 'nenhuma ainda');
	const member_since = me?.created_at ? `${ MONTH_NAMES_PT[new Date(me.created_at).getMonth()]?.toLowerCase() } de ${ new Date(me.created_at).getFullYear() }` : null;
	const theme_summary = preference === 'system' ? `Seguindo o sistema (${ theme === 'dark' ? 'escuro' : 'claro' } agora)` : `Sempre ${ preference === 'dark' ? 'escuro' : 'claro' }`;

	const setMainWallet = (wallet_id: string) => {
		if (!wallet_id || wallet_id === main_wallet?.id) return;
		updateCurrentUserMutation({
			body: { main_wallet_id: wallet_id },
			onSuccess: () => {
				toast.success('Carteira principal atualizada');
				queryClient.invalidateQueries({ queryKey: [ QUERY_KEYS.wallet.get_main ] });
			},
			onError: (error) => toast.error(getApiErrorMessage(error, 'Erro ao definir carteira principal')),
		});
	};

	/* ---------- Peças ---------- */
	const profileHero = (
		<section className={cn(HERO, 'p-5 md:p-6')}>
			<div aria-hidden='true' className={HERO_GLOW} />
			<div className='relative flex flex-col gap-4'>
				<div className='flex items-center gap-4'>
					<span className='flex size-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-bold md:size-16 md:text-xl'>{initials(me?.name)}</span>
					<div className='flex min-w-0 flex-col'>
						<span className='truncate text-xl font-bold tracking-[-0.02em] md:text-2xl'>{me?.name}</span>
						<span className='truncate text-sm text-[#A9B6BF]'>{me?.email}</span>
						{member_since && <span className='text-xs text-[#A9B6BF] md:hidden'>Membro desde {member_since}</span>}
					</div>
				</div>
				<div className='hidden flex-wrap gap-2 md:flex'>
					{member_since && <span className='rounded-full bg-white/10 px-3 py-1 text-xs font-semibold'>Membro desde {member_since}</span>}
					{main_wallet && (
						<span className='inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold'>
							<Star className='size-3.5 text-[#F2D58A]' />Carteira principal · {main_wallet.name}
						</span>
					)}
				</div>
			</div>
		</section>
	);

	const appearanceCard = (
		<section className={SETTINGS_CARD}>
			<div className='flex flex-col gap-0.5'>
				<h3 className='text-lg font-bold'>Aparência</h3>
				<p className='text-sm text-muted-foreground'>{theme_summary}.</p>
			</div>
			<SegmentedControl segments={THEME_SEGMENTS} value={preference} onChange={(value) => setPreference(value as TThemePreference)} />
		</section>
	);

	const mainWalletCard = (
		<section className={SETTINGS_CARD}>
			<div className='flex flex-col gap-0.5'>
				<h3 className='text-lg font-bold'>Carteira principal</h3>
				<p className='text-sm text-muted-foreground'>A Início sempre abre nela.</p>
			</div>
			<Select value={main_wallet?.id ?? ''} onValueChange={setMainWallet} disabled={is_main_pending}>
				<SelectTrigger className='h-12 rounded-2xl text-[15px] font-semibold' aria-label='Carteira principal'>
					<Star className='mr-2 size-4 shrink-0 fill-current text-brand' />
					<span className='min-w-0 flex-1 truncate text-left'><SelectValue placeholder='Escolha a carteira' /></span>
				</SelectTrigger>
				<SelectContent>
					{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}
				</SelectContent>
			</Select>
		</section>
	);

	const bankCard = (
		<section className={SETTINGS_CARD}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex flex-col gap-0.5'>
					<h3 className='text-lg font-bold'>Integração bancária</h3>
					<p className='text-sm text-muted-foreground'>
						Liberada para a sua conta. As conexões com bancos ficam em Contas & Cartões, aba Bancos.
					</p>
				</div>
				<Badge variant='success' dot>Ativa</Badge>
			</div>
			<Button asChild variant='outline' className='h-11 self-start gap-2 px-5'>
				<Link to='/contas?aba=bancos'>Ver bancos conectados <ChevronRight className='size-4' /></Link>
			</Button>
		</section>
	);

	/* Excluir conta (backend #25): cartão no fim da seção Conta (tablet/desktop) e linha no grupo Conta (celular). */
	const deleteDialog = <DeleteAccountDialog open={delete_open} onOpenChange={setDeleteOpen} />;
	const deleteCard = (
		<section className={cn(SETTINGS_CARD, 'flex-row items-center gap-4')}>
			<span className='flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-danger-soft text-destructive'><Trash2 className='size-[18px]' /></span>
			<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
				<span className='font-bold'>Excluir conta</span>
				<span className='text-[13px] text-muted-foreground'>A conta é bloqueada na hora e os seus dados são apagados de vez em 30 dias.</span>
			</span>
			<Button type='button' variant='outline' onClick={() => setDeleteOpen(true)} className='h-11 shrink-0 px-[18px] font-bold text-destructive hover:text-destructive'>Excluir conta</Button>
			{deleteDialog}
		</section>
	);

	const aboutCard = (
		<section className={SETTINGS_CARD}>
			<h3 className='text-lg font-bold'>Sobre</h3>
			<AboutInfo />
		</section>
	);

	/* Linha de lista (celular) / item do menu (desktop). */
	const row = (key: TSection, icon: LucideIcon, title: string, subtitle: string, trailing?: ReactNode, onClick?: ()=> void) => {
		const Icon = icon;
		return (
			<button
				key={key}
				type='button'
				data-section={key}
				onClick={onClick ?? (() => setSection(key))}
				className={cn(
					'pressable relative z-10 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
					!(is_wide && active === key) && 'hover:bg-accent/50'
				)}
			>
				<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'><Icon className='size-[18px]' /></span>
				<span className='flex min-w-0 flex-1 flex-col'>
					<span className='font-semibold leading-tight max-lg:truncate'>{title}</span>
					<span className='truncate text-xs text-muted-foreground'>{subtitle}</span>
				</span>
				{trailing}
				{!is_wide && !trailing && <ChevronRight className='size-4 shrink-0 text-muted-foreground' />}
			</button>
		);
	};

	const pending_dot = pending_sessions > 0 && <span className='size-2 shrink-0 rounded-full bg-warning-dot' aria-label='Conexão aguardando' />;

	const sectionTitle: Record<TSection, string> = {
		account: 'Conta', account_info: 'Informações pessoais', password: 'Senha', appearance: 'Aparência',
		main_wallet: 'Carteira principal', claude: 'Conexões com o Claude', bank: 'Integração bancária', about: 'Sobre',
	};

	const sectionContent = (key: TSection) => {
		switch (key) {
			case 'account':
				return (
					<div className='flex flex-col gap-4'>
						{profileHero}
						<div className='grid gap-4 md:grid-cols-2'>
							<AccountInfoForm />
							<AccountPasswordForm />
						</div>
						{deleteCard}
					</div>
				);
			case 'account_info': return <AccountInfoForm />;
			case 'password': return <AccountPasswordForm />;
			case 'appearance': return appearanceCard;
			case 'main_wallet': return mainWalletCard;
			case 'claude': return <ClaudeConnections />;
			case 'bank': return bankCard;
			default: return aboutCard;
		}
	};

	const header = (
		<header className='flex items-center justify-between gap-3'>
			<h1 className='text-2xl font-bold tracking-[-0.03em] md:text-[28px]'>Configurações</h1>
			<Button type='button' variant='outline' onClick={logout} className='hidden h-11 gap-2 px-4 text-destructive hover:text-destructive md:inline-flex lg:hidden'>
				<LogOut className='size-4' />Sair
			</Button>
		</header>
	);

	/* ---------- Tela de um item (celular e tablet em pé) ---------- */
	if (!is_wide && section) {
		return (
			<div key={section} className={cn('flex flex-col gap-4', ENTER_FORWARD)}>
				<header className='flex items-center gap-3'>
					<button type='button' aria-label='Voltar' onClick={() => setSection(null)} className='pressable flex size-11 shrink-0 items-center justify-center rounded-full border border-border'>
						<ChevronLeft className='size-5' />
					</button>
					<h1 className='truncate text-xl font-bold tracking-[-0.02em]'>{sectionTitle[section]}</h1>
				</header>
				{sectionContent(section)}
			</div>
		);
	}

	/* ---------- Desktop e tablet deitado: menu + seção ---------- */
	if (is_wide) {
		return (
			<div className='flex flex-col gap-5'>
				{header}
				<div className='grid grid-cols-[240px_minmax(0,1fr)] items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]'>
					<nav ref={menu_ref} className='relative flex flex-col gap-1' aria-label='Seções das configurações'>
						<LiquidBlob blob={menu_blob} className='rounded-2xl' />
						{row('account', User, 'Conta', 'Nome, e-mail e senha')}
						{row('appearance', Palette, 'Aparência', preference === 'system' ? 'Seguindo o sistema' : theme_summary)}
						{row('main_wallet', Star, 'Carteira principal', main_wallet?.name ?? '—')}
						{row('claude', Bot, 'Conexões com o Claude', claude_summary, pending_dot || undefined)}
						{pluggy_enabled && row('bank', Landmark, 'Integração bancária', 'Ativa na sua conta')}
						{row('about', Info, 'Sobre', 'Versões, termos e privacidade')}
						<LegalLinks className='px-3 pt-2 text-xs text-muted-foreground' />
					</nav>
					<div key={active} className={cn('min-w-0', direction && ENTER_SECTION)}>{sectionContent(active)}</div>
				</div>
			</div>
		);
	}

	/* ---------- Tablet em pé: tudo empilhado ---------- */
	if (is_tablet) {
		return (
			<div className={cn('flex flex-col gap-4', direction === 'back' && ENTER_BACK)}>
				{header}
				{sectionContent('account')}
				<div className='grid grid-cols-2 gap-4'>
					{appearanceCard}
					{mainWalletCard}
				</div>
				<section className={SETTINGS_CARD}>
					<h3 className='text-lg font-bold'>Integrações</h3>
					<div className='flex flex-col divide-y divide-border'>
						{row('claude', Bot, 'Conexões com o Claude', 'Consultar e lançar conversando com o Claude', (
							<span className='flex items-center gap-2'>
								{active_sessions > 0 && <Badge variant='success'>{active_sessions} {active_sessions === 1 ? 'ativa' : 'ativas'}</Badge>}
								{pending_sessions > 0 && <Badge variant='warning'>{pending_sessions} aguardando</Badge>}
								<ChevronRight className='size-4 text-muted-foreground' />
							</span>
						))}
						{pluggy_enabled && row('bank', Landmark, 'Integração bancária', 'Liberada para sua conta · as conexões ficam em Contas', (
							<Badge variant='success' dot>Ativa</Badge>
						))}
					</div>
				</section>
				<section className={cn(SURFACE, 'flex items-center gap-3 rounded-3xl p-5')}>
					<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'><Info className='size-[18px]' /></span>
					<span className='font-bold'>Sobre</span>
					<AboutInfo inline className='ml-auto' />
				</section>
				<LegalLinks className='justify-center text-xs text-muted-foreground' />
			</div>
		);
	}

	/* ---------- Celular: lista agrupada ---------- */
	const group = (title: string, children: ReactNode) => (
		<section className='flex flex-col gap-2'>
			<span className='px-1 text-xs font-semibold text-muted-foreground'>{title}</span>
			<div className={cn(SURFACE, 'flex flex-col divide-y divide-border rounded-3xl p-1.5')}>{children}</div>
		</section>
	);

	return (
		<div className={cn('flex flex-col gap-5', direction === 'back' && ENTER_BACK)}>
			<h1 className='text-2xl font-bold tracking-[-0.03em]'>Configurações</h1>
			{profileHero}
			{group('Conta', (
				<>
					{row('account_info', User, 'Informações pessoais', 'Nome e e-mail')}
					{row('password', Lock, 'Senha', 'Trocar a senha de acesso')}
					<button type='button' onClick={() => setDeleteOpen(true)} className='pressable flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-destructive'>
						<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft'><Trash2 className='size-[18px]' /></span>
						<span className='flex min-w-0 flex-1 flex-col'>
							<span className='font-semibold leading-tight'>Excluir conta</span>
							<span className='truncate text-xs text-muted-foreground'>Apaga a conta e os seus dados</span>
						</span>
						<ChevronRight className='size-4 shrink-0 text-muted-foreground' />
					</button>
					{deleteDialog}
				</>
			))}
			{group('Preferências', (
				<>
					<div className='flex flex-col gap-3 px-3 py-3'>
						<span className='flex items-center gap-3'>
							<span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary'><Palette className='size-[18px]' /></span>
							<span className='flex min-w-0 flex-col'>
								<span className='font-semibold'>Aparência</span>
								<span className='truncate text-xs text-muted-foreground'>{theme_summary}</span>
							</span>
						</span>
						<SegmentedControl segments={THEME_SEGMENTS} value={preference} onChange={(value) => setPreference(value as TThemePreference)} />
					</div>
					{row('main_wallet', Star, 'Carteira principal', main_wallet ? `${ main_wallet.name } · a Início abre nela` : '—')}
				</>
			))}
			{group('Integrações', (
				<>
					{row('claude', Bot, 'Conexões com o Claude', claude_summary, pending_dot ? <span className='flex items-center gap-2'>{pending_dot}<ChevronRight className='size-4 text-muted-foreground' /></span> : undefined)}
					{pluggy_enabled && row('bank', Landmark, 'Integração bancária', 'Liberada para você · veja em Contas', (
						<Badge variant='success' dot>Ativa</Badge>
					))}
				</>
			))}
			<button type='button' onClick={logout} className='pressable flex h-14 items-center justify-center gap-2 rounded-3xl border border-border font-bold text-destructive'>
				<LogOut className='size-4' />Sair da conta
			</button>
			<button type='button' onClick={() => setSection('about')} className='flex items-center justify-center gap-1.5 text-xs text-muted-foreground'>
				<Info className='size-3.5' />Sobre · {versions.label.toLowerCase()} <span className='font-mono'>{versions.app}</span> · API <span className='font-mono'>{versions.api}</span>
			</button>
			<LegalLinks className='-mt-2 justify-center text-xs text-muted-foreground' />
		</div>
	);
};

/*
 * As telas entram deslizando de lado (ENTER_FORWARD/ENTER_BACK) e, durante o deslize, passavam da borda e davam
 * rolagem horizontal ao <main> por um instante. `overflow-x: clip` corta só na horizontal sem virar contêiner de
 * rolagem; a margem de 1rem (= o padding lateral do template) deixa as sombras dos cartões aparecerem.
 */
const SettingsPage = () => (
	<div className='overflow-x-clip [overflow-clip-margin:1rem]'>
		<SettingsContent />
	</div>
);

export default SettingsPage;
