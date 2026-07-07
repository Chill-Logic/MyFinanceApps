import { lazy } from 'react';

/**
 * `lazy()` precisa ser chamado uma única vez por template e reaproveitado — cada chamada
 * cria uma referência de componente nova pro React, mesmo apontando pro mesmo arquivo.
 * Antes, cada grupo de rotas (e cada rota dentro do mesmo grupo) chamava
 * `lazy(() => import('@/components/templates/Default'))` separadamente, o que fazia o
 * React tratar como um componente *diferente* a cada rota — desmontando e remontando o
 * template inteiro (Sidebar, BottomNav) em toda troca de tela, mesmo entre rotas que usam
 * "o mesmo" template. Isso quebrava qualquer estado local do template (e any transição
 * que dependesse de um valor mudando dentro de uma instância montada, em vez de nascer já
 * no valor final a cada remount).
 */
export const DefaultTemplate = lazy(() => import('@/components/templates/Default'));
export const AuthTemplate = lazy(() => import('@/components/templates/Auth'));
