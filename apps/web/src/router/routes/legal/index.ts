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
];
