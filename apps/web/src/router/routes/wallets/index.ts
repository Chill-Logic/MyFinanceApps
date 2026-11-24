import MyWalletsPage from '@/pages/wallets';
import WalletsInvitesPage from '@/pages/wallets/invites';

import { IPath } from '@/types';

import DefaultTemplate from '@/components/templates/Default';

export const WalletsPaths: IPath[] = [
	{
		id: 'my_wallets',
		display: 'Carteiras',
		path: '/carteiras',
		element: MyWalletsPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
	{
		id: 'wallets_invites',
		display: 'Convites',
		path: '/carteiras/convites',
		element: WalletsInvitesPage,
		template: DefaultTemplate,
		isPrivate: true,
	},
];
