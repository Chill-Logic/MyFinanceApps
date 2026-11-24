import MyWalletsPage from '@/pages/wallets';
import WalletsInvitesPage from '@/pages/wallets/invites';

import { IPath } from '@/types';

import DefaultTemplate from '@/components/templates/Default';

export const WalletsPaths: IPath[] = [
	{
		id: 'my_wallets',
		display: 'Carteiras',
		path: '/wallets',
		element: MyWalletsPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
	{
		id: 'wallets_invites',
		display: 'Convites',
		path: '/wallets/invites',
		element: WalletsInvitesPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
];
