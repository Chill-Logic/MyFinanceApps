import AccountDeletedPage from '@/pages/account-deleted';
import DeleteAccountInfoPage from '@/pages/delete-account';
import PrivacyPage from '@/pages/privacy';
import TermsPage from '@/pages/terms';

import { IPath } from '@/types';

import BlankTemplate from '@/components/templates/Blank';

/* Públicas (sem login e sem redirecionar quem está logado): a Play e quem recebe o link precisam abrir. */
export const LegalPaths: IPath[] = [
	{
		id: 'privacy',
		display: 'Política de Privacidade',
		path: 'privacidade',
		element: PrivacyPage,
		template: BlankTemplate,
	},
	{
		id: 'terms',
		display: 'Termos de Uso',
		path: 'termos',
		element: TermsPage,
		template: BlankTemplate,
	},
	{
		/* Link que vai pra Play: como excluir a conta sem o app (backend #25). */
		id: 'delete-account-info',
		display: 'Excluir sua conta',
		path: 'excluir-conta',
		element: DeleteAccountInfoPage,
		template: BlankTemplate,
	},
	{
		/* Depois da exclusão (a sessão já acabou). */
		id: 'account-deleted',
		display: 'Conta excluída',
		path: 'conta-excluida',
		element: AccountDeletedPage,
		template: BlankTemplate,
	},
];
