/*
 * Textos dos documentos legais (Termos de Uso e Política de Privacidade), versão 1.0.
 *
 * Mudou o texto de forma relevante? Suba a versão aqui E no backend (issue #26 do my-finance-api): é a versão do
 * backend que decide quem precisa aceitar de novo. Correção de digitação não muda versão.
 *
 * Trechos entre `[[...]]` são dados que ainda faltam: `LEGAL_INFO` traz o valor de cada um. Enquanto um valor estiver
 * `null`, a página mostra o rótulo destacado — os documentos só podem ir pra produção com todos preenchidos.
 */

export type TLegalBlock =
	| { kind: 'p'; text: string }
	| { kind: 'ol' | 'ul'; items: string[] }
	| { kind: 'dl'; items: [string, string][] };

export type TLegalSection = { id: string; title: string; blocks: TLegalBlock[] };

export type TLegalDocument = { title: string; version: string; sections: TLegalSection[] };

export const LEGAL_INFO: Record<string, string | null> = {
	'nomes dos responsáveis': 'Jhonathan Carvalho e Gabriel Paranhos',
	'e-mail de contato': 'contato@chillogic.com.br',
	'provedor de e-mail': null,
	'X': null,
	'endereço da página de exclusão': null,
	'data de publicação': '24 de novembro de 2026',
};

export const PRIVACY_SECTIONS: TLegalSection[] = [
	{
		id: 'sobre',
		title: 'Sobre esta política',
		blocks: [
			{ kind: 'p', text: 'Esta Política de Privacidade descreve como o MyFinance, aplicativo de organização e planejamento financeiro desenvolvido pelo projeto Chillogic, coleta, utiliza, armazena e protege os dados pessoais de seus usuários, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).' },
			{ kind: 'p', text: 'Os controladores dos dados pessoais são [[nomes dos responsáveis]], que atuam em conjunto e podem ser contatados pelo e-mail [[e-mail de contato]]. Ao criar uma conta ou utilizar o MyFinance, o usuário declara ter lido e compreendido esta Política.' },
		],
	},
	{
		id: 'dados',
		title: 'Dados pessoais tratados',
		blocks: [
			{ kind: 'dl', items: [
				[ 'Dados de cadastro', 'Nome, endereço de e-mail e senha. A senha é armazenada exclusivamente em formato criptografado (hash) e não pode ser recuperada em texto legível.' ],
				[ 'Dados inseridos pelo usuário', 'Carteiras, contas, cartões de crédito, transações, recorrências e demais informações financeiras registradas voluntariamente no aplicativo, bem como preferências de uso, como tema e forma de exibição das faturas.' ],
				[ 'Carteiras compartilhadas', 'Endereços de e-mail das pessoas convidadas e a relação de membros de cada carteira.' ],
				[ 'Registros de alteração', 'Identificação do usuário responsável pela criação ou modificação de cada registro, mantida para garantir a rastreabilidade das informações em carteiras compartilhadas.' ],
				[ 'Registros técnicos', 'Endereço IP, data e hora de acesso, registrados automaticamente pelo servidor para fins de segurança e funcionamento do serviço.' ],
				[ 'Dados de integrações', 'Quando o usuário opta por utilizar as integrações descritas na seção 4, o MyFinance recebe os dados indicados naquela seção.' ],
			] },
		],
	},
	{
		id: 'finalidades',
		title: 'Finalidades e bases legais',
		blocks: [
			{ kind: 'p', text: 'Os dados pessoais são tratados exclusivamente para:' },
			{ kind: 'ol', items: [
				'criar e manter a conta do usuário e autenticar seu acesso;',
				'prestar as funcionalidades do aplicativo, como o cálculo de saldos, faturas e projeções;',
				'permitir o compartilhamento de carteiras entre usuários, por iniciativa do próprio usuário;',
				'enviar comunicações operacionais, como convites e instruções de redefinição de senha;',
				'garantir a segurança do serviço e prevenir acessos indevidos.',
			] },
			{ kind: 'p', text: 'O tratamento fundamenta-se na execução do contrato com o titular (art. 7º, V, da LGPD) e, quanto aos registros de alteração e aos registros técnicos, no legítimo interesse do controlador (art. 7º, IX).' },
		],
	},
	{
		id: 'integracoes',
		title: 'Integrações opcionais',
		blocks: [
			{ kind: 'p', text: 'O MyFinance oferece integrações opcionais, ativadas somente por iniciativa do usuário.' },
			{ kind: 'dl', items: [
				[ 'Autenticação com o Google', 'Ao optar por entrar com sua conta Google, o usuário autoriza o Google a informar ao MyFinance seu nome, endereço de e-mail e identificador da conta. O MyFinance não envia ao Google nenhum dado registrado no aplicativo.' ],
				[ 'Conexão com o Claude', 'O usuário pode autorizar o assistente Claude, da Anthropic, a acessar sua conta do MyFinance. O acesso depende de aprovação expressa do usuário e permite ao Claude consultar e alterar informações conforme as solicitações feitas por ele. Todas as ações executadas por meio dessa conexão ficam registradas em Configurações, e a autorização pode ser revogada a qualquer momento.' ],
			] },
			{ kind: 'p', text: 'O tratamento de dados realizado pelo Google e pela Anthropic em seus próprios serviços é regido pelas respectivas políticas de privacidade.' },
		],
	},
	{
		id: 'compartilhamento',
		title: 'Compartilhamento de dados',
		blocks: [
			{ kind: 'p', text: 'O MyFinance não vende, aluga ou compartilha dados pessoais com terceiros para fins comerciais, publicitários ou de formação de perfil, e não utiliza ferramentas de análise de comportamento, rastreamento ou publicidade.' },
			{ kind: 'p', text: 'Os dados são armazenados e processados por prestadores de serviços de infraestrutura, que atuam como operadores e os tratam unicamente para viabilizar o funcionamento do aplicativo: Railway (servidor e banco de dados), Vercel (hospedagem do site) e [[provedor de e-mail]] (envio de e-mails operacionais). Esses prestadores podem manter servidores fora do Brasil; nesse caso, a transferência internacional ocorre para a execução do contrato com o titular (art. 33, IX, da LGPD).' },
			{ kind: 'p', text: 'Os dados de uma carteira compartilhada ficam visíveis aos membros convidados pelo próprio usuário. Os dados somente serão fornecidos a autoridades públicas mediante obrigação legal ou ordem judicial.' },
		],
	},
	{
		id: 'seguranca',
		title: 'Segurança',
		blocks: [
			{ kind: 'p', text: 'O MyFinance adota medidas técnicas e administrativas para proteger os dados pessoais, incluindo a criptografia das comunicações (HTTPS), o armazenamento das senhas em formato criptografado e o controle de acesso mediante autenticação.' },
			{ kind: 'p', text: 'Na ocorrência de incidente de segurança que possa acarretar risco ou dano relevante, os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD) serão comunicados, nos termos da LGPD.' },
		],
	},
	{
		id: 'retencao',
		title: 'Retenção dos dados',
		blocks: [
			{ kind: 'p', text: 'Os dados pessoais são mantidos enquanto a conta do usuário estiver ativa. Após a solicitação de exclusão, são eliminados no prazo de até 30 dias, conforme a seção 9. As cópias de segurança são sobrescritas em até [[X]] dias.' },
			{ kind: 'p', text: 'Poderão ser conservados, pelo prazo necessário, os dados cuja manutenção seja exigida por obrigação legal ou regulatória.' },
		],
	},
	{
		id: 'direitos',
		title: 'Direitos do titular',
		blocks: [
			{ kind: 'p', text: 'Nos termos do art. 18 da LGPD, o titular pode solicitar, a qualquer momento:' },
			{ kind: 'ul', items: [
				'confirmação da existência de tratamento e acesso aos dados;',
				'correção de dados incompletos, inexatos ou desatualizados;',
				'anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;',
				'portabilidade dos dados a outro fornecedor de serviço;',
				'eliminação dos dados e revogação de autorizações concedidas;',
				'informação sobre as entidades com as quais os dados foram compartilhados.',
			] },
			{ kind: 'p', text: 'A correção de dados cadastrais, a revogação das integrações e a exclusão da conta podem ser feitas diretamente no aplicativo. As demais solicitações devem ser enviadas para [[e-mail de contato]] e serão respondidas em até 15 dias.' },
		],
	},
	{
		id: 'exclusao',
		title: 'Exclusão da conta',
		blocks: [
			{ kind: 'p', text: 'O usuário pode excluir sua conta a qualquer momento em Configurações › Conta › Excluir conta ou, sem acesso ao aplicativo, pela página [[endereço da página de exclusão]]. A partir da solicitação, o acesso à conta é bloqueado, as autorizações concedidas às integrações são revogadas e os dados são definitivamente eliminados em até 30 dias.' },
			{ kind: 'p', text: 'Quanto às carteiras:' },
			{ kind: 'ol', items: [
				'carteiras administradas exclusivamente pelo usuário são eliminadas com todo o seu conteúdo;',
				'carteiras administradas pelo usuário que possuam outros membros têm a administração transferida ao membro com maior atividade recente e permanecem disponíveis aos demais;',
				'nas carteiras em que o usuário participa como membro, os registros por ele criados são mantidos de forma anonimizada, sem identificação do autor.',
			] },
		],
	},
	{
		id: 'publico',
		title: 'Público-alvo',
		blocks: [
			{ kind: 'p', text: 'O MyFinance destina-se a pessoas maiores de 18 anos e não coleta intencionalmente dados de menores de idade. Contas identificadas como pertencentes a menores poderão ser excluídas.' },
		],
	},
	{
		id: 'alteracoes',
		title: 'Alterações desta política',
		blocks: [
			{ kind: 'p', text: 'Esta Política poderá ser atualizada para refletir mudanças no aplicativo ou na legislação aplicável. Alterações relevantes serão comunicadas no aplicativo antes de entrarem em vigor. A data da versão vigente consta no início deste documento.' },
		],
	},
	{
		id: 'contato',
		title: 'Contato',
		blocks: [
			{ kind: 'p', text: 'Dúvidas, solicitações ou reclamações relacionadas a esta Política ou ao tratamento de dados pessoais podem ser encaminhadas para [[e-mail de contato]]. O titular também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).' },
		],
	},
];

export const TERMS_SECTIONS: TLegalSection[] = [
	{
		id: 'aceitacao',
		title: 'Aceitação dos termos',
		blocks: [
			{ kind: 'p', text: 'Estes Termos de Uso regulam a utilização do MyFinance, aplicativo de organização e planejamento financeiro desenvolvido pelo projeto Chillogic e mantido por [[nomes dos responsáveis]].' },
			{ kind: 'p', text: 'Ao criar uma conta ou utilizar o aplicativo, o usuário declara ter lido e aceito estes Termos e a Política de Privacidade, que integra este documento. Caso não concorde com qualquer disposição, o usuário não deve utilizar o MyFinance.' },
		],
	},
	{
		id: 'servico',
		title: 'O serviço',
		blocks: [
			{ kind: 'p', text: 'O MyFinance é uma ferramenta de registro, organização e planejamento de finanças pessoais. Permite cadastrar contas, cartões de crédito, transações e recorrências, acompanhar faturas e saldos e projetar a evolução financeira com base nas informações registradas.' },
			{ kind: 'p', text: 'O MyFinance não é instituição financeira nem de pagamento: não movimenta valores, não realiza pagamentos ou transferências, não concede crédito e não presta consultoria financeira, contábil ou de investimentos. Saldos, faturas e projeções exibidos são calculados a partir dos dados informados pelo próprio usuário e têm caráter exclusivamente informativo.' },
		],
	},
	{
		id: 'fase',
		title: 'Fase de testes e cobrança',
		blocks: [
			{ kind: 'p', text: 'O MyFinance encontra-se em fase de testes. Durante esse período, o acesso é oferecido sem custo, e o aplicativo pode apresentar falhas, instabilidades e mudanças frequentes de funcionalidades.' },
			{ kind: 'p', text: 'O acesso sem custo durante a fase de testes não implica gratuidade permanente. Planos pagos poderão ser instituídos no futuro; nesse caso, preços, condições e funcionalidades de cada plano serão informados com antecedência mínima de 30 dias, e nenhuma cobrança será realizada sem a contratação expressa do usuário.' },
			{ kind: 'p', text: 'O usuário que não desejar contratar um plano pago poderá encerrar sua conta a qualquer momento, conforme o procedimento descrito na Política de Privacidade.' },
		],
	},
	{
		id: 'conta',
		title: 'Cadastro e conta',
		blocks: [
			{ kind: 'ol', items: [
				'o uso do MyFinance é restrito a pessoas maiores de 18 anos;',
				'o usuário deve fornecer informações verdadeiras e mantê-las atualizadas;',
				'a conta é pessoal e intransferível, e o usuário é responsável pela confidencialidade de suas credenciais de acesso;',
				'qualquer uso não autorizado da conta deve ser comunicado imediatamente pelo e-mail [[e-mail de contato]].',
			] },
		],
	},
	{
		id: 'carteiras',
		title: 'Carteiras compartilhadas',
		blocks: [
			{ kind: 'p', text: 'O usuário pode convidar outras pessoas para participar de uma carteira. Ao aceitar o convite, o membro passa a visualizar e registrar informações naquela carteira.' },
			{ kind: 'p', text: 'Quem cria a carteira é o seu administrador e pode editá-la, excluí-la e convidar novos membros. Qualquer membro pode deixar a carteira a qualquer momento. Cada usuário é responsável pelas pessoas que convida e pelas informações que registra em carteiras compartilhadas.' },
		],
	},
	{
		id: 'integracoes',
		title: 'Integrações com serviços de terceiros',
		blocks: [
			{ kind: 'p', text: 'O MyFinance permite, de forma opcional, a autenticação com o Google e a conexão com o assistente Claude, da Anthropic. O uso dessas integrações está sujeito também aos termos e às políticas dos respectivos serviços.' },
			{ kind: 'p', text: 'As ações executadas pelo Claude na conta do usuário decorrem de solicitações do próprio usuário, que é responsável por elas. A conexão pode ser revogada a qualquer momento em Configurações.' },
		],
	},
	{
		id: 'uso',
		title: 'Uso adequado',
		blocks: [
			{ kind: 'p', text: 'É vedado ao usuário:' },
			{ kind: 'ol', items: [
				'utilizar o MyFinance para fins ilícitos ou contrários a estes Termos;',
				'acessar ou tentar acessar contas, carteiras ou dados de terceiros sem autorização;',
				'interferir no funcionamento do serviço, sobrecarregá-lo ou explorar suas vulnerabilidades;',
				'realizar engenharia reversa, copiar ou redistribuir o aplicativo, salvo nos limites permitidos pela lei;',
				'utilizar meios automatizados para acessar o serviço, exceto pelas integrações oferecidas pelo próprio MyFinance.',
			] },
		],
	},
	{
		id: 'conteudo',
		title: 'Dados do usuário',
		blocks: [
			{ kind: 'p', text: 'As informações registradas no MyFinance pertencem ao usuário. Ao utilizá-lo, o usuário autoriza seu armazenamento e processamento exclusivamente para a prestação do serviço, nos termos da Política de Privacidade.' },
			{ kind: 'p', text: 'O usuário é o único responsável pela exatidão das informações que registra.' },
		],
	},
	{
		id: 'propriedade',
		title: 'Propriedade intelectual',
		blocks: [
			{ kind: 'p', text: 'O aplicativo, sua marca, seu código-fonte, sua interface e demais elementos são de titularidade de [[nomes dos responsáveis]] e protegidos pela legislação de propriedade intelectual. Estes Termos não transferem ao usuário nenhum direito sobre eles, além da licença pessoal, intransferível e revogável de uso do aplicativo.' },
		],
	},
	{
		id: 'disponibilidade',
		title: 'Disponibilidade e alterações do serviço',
		blocks: [
			{ kind: 'p', text: 'O MyFinance pode passar por manutenções, interrupções ou instabilidades. Funcionalidades podem ser criadas, modificadas ou descontinuadas a qualquer tempo. Alterações que afetem de forma relevante o uso do aplicativo serão comunicadas previamente sempre que possível.' },
		],
	},
	{
		id: 'responsabilidade',
		title: 'Limitação de responsabilidade',
		blocks: [
			{ kind: 'p', text: 'Na extensão permitida pela legislação aplicável, os responsáveis pelo MyFinance não respondem por:' },
			{ kind: 'ol', items: [
				'decisões financeiras tomadas pelo usuário com base nas informações exibidas no aplicativo;',
				'imprecisões decorrentes de dados registrados de forma incorreta ou incompleta;',
				'indisponibilidades temporárias do serviço ou falhas em serviços de terceiros;',
				'danos decorrentes do uso indevido da conta por falta de cuidado com as credenciais de acesso.',
			] },
		],
	},
	{
		id: 'encerramento',
		title: 'Suspensão e encerramento',
		blocks: [
			{ kind: 'p', text: 'O usuário pode encerrar sua conta a qualquer momento, conforme o procedimento descrito na Política de Privacidade.' },
			{ kind: 'p', text: 'Contas utilizadas em desacordo com estes Termos poderão ser suspensas ou encerradas, mediante aviso prévio sempre que possível.' },
		],
	},
	{
		id: 'alteracoes',
		title: 'Alterações destes termos',
		blocks: [
			{ kind: 'p', text: 'Estes Termos poderão ser atualizados. Em caso de alteração relevante, o usuário será notificado no aplicativo e deverá aceitar a nova versão para continuar a utilizá-lo. A data da versão vigente consta no início deste documento.' },
		],
	},
	{
		id: 'foro',
		title: 'Legislação aplicável e foro',
		blocks: [
			{ kind: 'p', text: 'Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do usuário para dirimir quaisquer controvérsias decorrentes deste documento.' },
		],
	},
	{
		id: 'contato',
		title: 'Contato',
		blocks: [
			{ kind: 'p', text: 'Dúvidas ou solicitações relacionadas a estes Termos podem ser encaminhadas para [[e-mail de contato]].' },
		],
	},
];

export const PRIVACY_POLICY: TLegalDocument = { title: 'Política de Privacidade', version: '1.0', sections: PRIVACY_SECTIONS };

export const TERMS_OF_USE: TLegalDocument = { title: 'Termos de Uso', version: '1.0', sections: TERMS_SECTIONS };
