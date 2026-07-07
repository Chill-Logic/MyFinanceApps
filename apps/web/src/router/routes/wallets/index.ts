import { lazy } from 'react';

import { DefaultTemplate } from '@/router/routes/templates';

import { IPath } from '@/types';

export const WalletsPaths: IPath[] = [
	{
		id: 'my_wallets',
		display: 'Carteiras',
		path: '/wallets',
		element: lazy(() => import('@/pages/wallets')),
		template: DefaultTemplate,
		isPrivate: true,
	},
	{
		id: 'wallets_invites',
		display: 'Convites',
		path: '/wallets/invites',
		element: lazy(() => import('@/pages/wallets/invites')),
		template: DefaultTemplate,
		isPrivate: true,
	},
];
