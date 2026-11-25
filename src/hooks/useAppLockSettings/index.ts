import { useSyncExternalStore } from 'react';

import { AppLockStore } from '@/services/app-lock';

/* Preferências da trava do app (por aparelho), reativas: a tela de bloqueio e as Configurações leem a mesma. */
const useAppLockSettings = () => {
	const settings = useSyncExternalStore(AppLockStore.subscribe, AppLockStore.get);
	return { settings, update: AppLockStore.update };
};

export default useAppLockSettings;
