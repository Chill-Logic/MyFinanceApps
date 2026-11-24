import { useCallback, useEffect, useRef, useState } from 'react';

import { App } from '@capacitor/app';
import { Download, Smartphone, TriangleAlert } from 'lucide-react';

import { AppUpdateService, TAppUpdateStatus } from '@/services/app-update';
import { is_native } from '@/services/native';

import Button from '@/components/atoms/Button';
import Logo from '@/components/atoms/Logo';
import { Notice, SheetDialog, SummaryTile } from '@/components/molecules/SheetDialog';
import Badge from '@/components/ui/badge';

/* Ao voltar pro app (resume), checa de novo no máximo a cada 30 min. */
const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

/* Versão cujo aviso o usuário dispensou com "Agora não" — não insiste nela de novo. */
const DISMISSED_KEY = 'app-update-dismissed-version';

const readDismissed = () => {
	try {
		return localStorage.getItem(DISMISSED_KEY);
	} catch {
		return null;
	}
};

const writeDismissed = (version_code: string) => {
	try {
		localStorage.setItem(DISMISSED_KEY, version_code);
	} catch {
		/* sem storage, o aviso só volta na próxima checagem */
	}
};

/*
 * Só em dev: `?preview-update=available` ou `=required` mostra o aviso no navegador (no app real ele depende da
 * Play, que só responde num app instalado pela loja).
 */
const previewStatus = (): TAppUpdateStatus | null => {
	if (!import.meta.env.DEV) return null;
	const mode = new URLSearchParams(window.location.search).get('preview-update');
	if (mode === 'available') return { kind: 'available', version_code: 'preview', current_version: '0.3.104' };
	if (mode === 'required') return { kind: 'required', current_version: '0.3.104' };
	return null;
};

/*
 * Aviso de atualização do app nativo (redesign 2026-11, mockup v3 "DlgUpdate"), no casco das janelas menores.
 * Montado uma vez no App; no navegador não renderiza nada.
 * - "available": versão nova na loja — dispensável ("Agora não", ×, por fora), uma vez por versão.
 * - "required": versão abaixo do mínimo (app-version.json) — sem ×, não fecha; só sai atualizando.
 */
const AppUpdatePrompt = () => {
	const [ status, setStatus ] = useState<TAppUpdateStatus>(() => previewStatus() ?? { kind: 'none' });
	const last_check_ref = useRef(0);

	const check = useCallback(async() => {
		last_check_ref.current = Date.now();
		const next = await AppUpdateService.check();
		if (next.kind === 'available' && readDismissed() === next.version_code) return;
		setStatus(next);
	}, []);

	useEffect(() => {
		if (!is_native) return;

		check();
		const listener = App.addListener('resume', () => {
			if (Date.now() - last_check_ref.current >= RECHECK_INTERVAL_MS) check();
		});

		return () => {
			listener.then((handle) => handle.remove());
		};
	}, [ check ]);

	if (status.kind === 'none') return null;

	const is_required = status.kind === 'required';

	const dismiss = () => {
		if (status.kind === 'available') writeDismissed(status.version_code);
		setStatus({ kind: 'none' });
	};

	const update = () => {
		/* Na obrigatória o aviso fica: se a pessoa voltar da loja sem atualizar, ele continua lá. */
		if (!is_required) setStatus({ kind: 'none' });
		AppUpdateService.update();
	};

	return (
		<SheetDialog
			open
			dismissible={!is_required}
			onOpenChange={(open) => !open && !is_required && dismiss()}
			title={is_required ? 'Atualize para continuar' : 'Nova versão disponível'}
			context={status.current_version ? `Você está na versão ${ status.current_version }` : undefined}
			contextIcon={Smartphone}
			footer={(
				<>
					{!is_required && (
						<Button type='button' variant='ghost' onClick={dismiss} className='h-12 px-5 max-md:w-full'>
							Agora não
						</Button>
					)}
					<Button type='button' onClick={update} className='h-12 px-7 font-bold max-md:w-full'>
						<Download className='size-4' />
						Atualizar agora
					</Button>
				</>
			)}
		>
			<SummaryTile className='flex-row items-center gap-3.5'>
				<Logo variant='icon' size={44} className='shrink-0' />
				<span className='flex min-w-0 flex-1 flex-col gap-0.5'>
					<span className='text-base font-bold'>MyFinance</span>
					<span className='text-[13px] text-muted-foreground'>Versão nova na Google Play</span>
				</span>
				<Badge variant={is_required ? 'warning' : 'brand'} dot>{is_required ? 'Obrigatória' : 'Nova'}</Badge>
			</SummaryTile>

			{is_required ? (
				<Notice tone='warning' icon={TriangleAlert}>
					Esta versão do app não funciona mais. Atualize para continuar usando — seus dados continuam como estão.
				</Notice>
			) : (
				<p className='px-1 text-sm text-muted-foreground'>
					Traz melhorias e correções. Seus dados continuam como estão.
				</p>
			)}
		</SheetDialog>
	);
};

export default AppUpdatePrompt;
