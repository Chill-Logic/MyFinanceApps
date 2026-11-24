import { ITemplateProps } from '@/types';

/* Sem casca nenhuma: a página desenha o próprio cabeçalho (documentos legais, públicos). */
const BlankTemplate = ({ children }: ITemplateProps) => <>{children}</>;

export default BlankTemplate;
