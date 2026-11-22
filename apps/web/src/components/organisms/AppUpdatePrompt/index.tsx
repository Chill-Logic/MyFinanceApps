import { useCallback, useEffect, useRef, useState } from 'react';

import { App } from '@capacitor/app';

import { AppUpdateService, TAppUpdateStatus } from '@/services/app-update';
import { is_native } from '@/services/native';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* Ao voltar pro app (resume), checa de novo no máximo a cada 30 min. */
const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

/* Versão cujo aviso o usuário dispensou com "Depois" — não insiste nela de novo. */
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
 * Aviso de atualização do app nativo. Montado uma vez no App; no navegador não renderiza nada.
 * - "available": versão nova na loja — aviso dispensável, uma vez por versão.
 * - "required": versão abaixo do mínimo (app-version.json) — não fecha; só sai atualizando.
 */
const AppUpdatePrompt = () => {
	const [ status, setStatus ] = useState<TAppUpdateStatus>({ kind: 'none' });
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

	return (
		<AlertDialog
			open
			onOpenChange={(open) => {
				/* Obrigatória não fecha (Escape/voltar do Android só tentam fechar a camada). */
				if (!open && !is_required) dismiss();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{is_required ? 'Atualize o MyFinance' : 'Nova versão disponível'}</AlertDialogTitle>
					<AlertDialogDescription>
						{is_required
							? 'Esta versão do app não é mais compatível. Atualize para continuar usando.'
							: 'Tem uma versão nova do MyFinance na loja, com melhorias e correções.'}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					{!is_required && <AlertDialogCancel onClick={dismiss}>Depois</AlertDialogCancel>}
					<AlertDialogAction
						onClick={(event) => {
							/* Na obrigatória o diálogo fica aberto: se a pessoa voltar sem atualizar, ele continua lá. */
							if (is_required) event.preventDefault();
							else setStatus({ kind: 'none' });
							AppUpdateService.update();
						}}
					>
						Atualizar
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};

export default AppUpdatePrompt;
