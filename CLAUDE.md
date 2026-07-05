# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Estrutura do repositório

Monorepo com npm workspaces (sem pnpm/yarn, sem Turborepo) com dois apps que compartilham o mesmo backend:

```
apps/mobile/     @myfinance/mobile — app React Native (RN CLI puro, sem Expo)
apps/web/        @myfinance/web    — app web em Vite + React
packages/shared/ @myfinance/shared — tipos de domínio, contratos de API e rotas do backend, compartilhados
```

`packages/shared` é a única fonte de verdade pra qualquer coisa que descreva o contrato com o backend:
`models.ts` (entidades de domínio: `TUser`, `TTransaction`, `TWallet`, `TInvite`), `api.ts` (tipos de
request/response + `TMutationParams`), `routes.ts` (`API_ROUTES`, o mapa de endpoints). Os dois apps
importam como uma dependência de workspace comum (sem etapa de build — o Metro e o Vite consomem o
TypeScript fonte diretamente). Ao adicionar ou mudar algo do contrato com o backend, edite ali uma
única vez; não redefina tipos equivalentes localmente em nenhum dos apps.

## Comandos

Instale uma vez a partir da raiz do repositório (instala todos os workspaces):

```bash
npm install
```

A raiz tem aliases prontos pra cada app, sem precisar lembrar da flag `--workspace`:

```bash
# mobile (apps/mobile, pacote @myfinance/mobile)
npm run mobile:start        # Metro dev server
npm run mobile:android
npm run mobile:ios
npm run mobile:lint
npm run mobile:test         # jest
npm run mobile:typecheck    # tsc --noEmit (não existe script equivalente dentro do app)

# web (apps/web, pacote @myfinance/web)
npm run webapp:dev          # vite dev server
npm run webapp:build        # tsc && vite build
npm run webapp:lint
npm run webapp:test         # jest
npm run webapp:storybook
```

Não existe script de build/lint/test genérico na raiz que rode os dois apps de uma vez — use sempre
um dos aliases acima, ou entre em `apps/mobile` / `apps/web` e rode o script diretamente.

iOS exige CocoaPods (`bundle install` e depois `bundle exec pod install` dentro de `apps/mobile`) —
ver `apps/mobile/README.md`.

### Configuração de ambiente local (mobile)

`apps/mobile/env.ts` (gitignored) é uma alternativa mantida à mão pro `react-native-dotenv`, que a
equipe achou pouco confiável nesse projeto (cache do Metro não invalidando, falhas silenciosas).
Exporta um objeto simples (`{ API_URL: "..." }`) importado via `@env`, tipado em `env.d.ts`. Não existe
num clone novo — recrie localmente. A expectativa é substituir isso por env vars do EAS se/quando o
mobile migrar pra Expo.

## Arquitetura

### apps/mobile (React Native, CLI puro)

- O ponto de entrada `App.tsx` aninha providers: `QueryClientProvider` (TanStack Query v5, fixado
  exatamente em `5.80.6` — ver abaixo) → `ThemeProvider` → `CurrentUserProvider` → `WalletUserProvider`
  → `RefreshProvider` → `MainStack` (React Navigation native-stack).
- `src/navigation/index.tsx` monta a stack a partir de um array `SCREENS` (`{ name, component }`) mais
  `AUTH_SCREENS` vindo de `src/navigation/auth`.
- `src/hooks/api/<recurso>/<useVerboRecurso>/index.ts` — uma pasta por hook, um hook por operação
  (ex: `hooks/api/transactions/useCreateTransactions`). Cada hook encapsula uma chamada `useQuery`/
  `useMutation` do TanStack Query, obtém uma instância do axios via `hooks/api/useAxiosInstance`
  (`getAxiosInstance()` lê o token de autenticação do `LocalStorage` e injeta
  `Authorization: Bearer <token>`), e tipa request/response com os tipos de `@myfinance/shared`
  reexportados por `src/types/api.ts` / `src/types/models.ts`. As strings de endpoint ficam em
  `packages/shared/src/routes.ts` (`API_ROUTES`).
- `src/services/storage` encapsula o `AsyncStorage` com um prefixo de chave próprio do app
  (`LocalStorage`).
- `src/components` segue o padrão atoms/organisms; `src/types/forms.ts`, `screen.ts` e `storage.ts`
  são específicos do mobile (formato de campos de formulário, tipos de parâmetros de navegação, chaves
  de storage) e não são compartilhados com o web.
- Imports são relativos (sem alias de path configurado/imposto no mobile), agrupados e ordenados
  alfabeticamente pelo `eslint-plugin-import-helpers` (react → módulos externos → hooks →
  util/services/context → types → components → parent/sibling/index).
- O Metro está configurado pro monorepo (`metro.config.js`): `watchFolders` inclui a raiz do repo e
  `resolver.nodeModulesPaths` lista explicitamente tanto `apps/mobile/node_modules` quanto o
  `node_modules` da raiz, com `disableHierarchicalLookup: true`. Ao adicionar um novo pacote de
  workspace, ele precisa resolver por um desses caminhos.
- `tsconfig.json` estende `@react-native/typescript-config` e sobrescreve `typeRoots` pra incluir
  explicitamente o `node_modules/@types` hoisted na raiz (`../../node_modules/@types`) — necessário
  porque o npm hoisteia a maioria dos pacotes `@types/*` pra raiz do repo em vez de
  `apps/mobile/node_modules`.
- Algumas dependências estão fixadas numa versão exata em vez de um range com `^`, porque versões mais
  novas compatíveis por semver quebraram algo assim que o lockfile do repo original (standalone) deixou
  de existir: `react-native-reanimated` (4.0.1), `react-native-screens` (4.11.1) e
  `@tanstack/react-query` (5.80.6 — versões 5.x mais novas degradam silenciosamente os genéricos de
  `useQuery`/`useMutation` pra `any` sob a versão de TypeScript deste projeto). Não solte esses ranges
  de volta pra `^` sem checar compatibilidade de peer/tipos antes.

### apps/web (Vite + React)

- A entrada `src/App.tsx` envolve o `Router` (de `src/router`) num `QueryClientProvider` — atenção que
  este app usa `react-query` v3 (API antiga: `useQuery(key, fn)`), *não* o `@tanstack/react-query` v5
  usado no mobile. São bibliotecas diferentes com APIs diferentes; não assuma que os padrões de
  data-fetching do mobile valem aqui.
- `src/router/index.tsx` renderiza as rotas a partir de `src/router/routes` (`Paths: IPath[]`), onde
  cada entrada tem `{ id, path, element, template, isMainPath? }` com `element`/`template` como imports
  `React.lazy`. As rotas são agrupadas por feature em `src/router/routes/<grupo>` (atualmente `default`,
  `auth`) e concatenadas em `src/router/routes/index.ts`, que também lança erro no carregamento do
  módulo se dois `id`s de rota colidirem. Pra adicionar rotas novas, estenda um desses arquivos de grupo
  (ou crie um grupo novo e inclua no `Paths`). O `template` de cada rota (ex:
  `components/templates/Auth`, `components/templates/Default`) envolve o layout/chrome da página.
- `src/components` segue o padrão atoms/molecules/templates (sem organisms, diferente do mobile).
- Alias de path `@` → `src` (configurado em `vite.config.ts` `resolve.alias` e consumido via
  `vite-tsconfig-paths`). Imports absolutos `@/...` são obrigatórios por lint
  (`no-relative-import-paths/no-relative-import-paths`, `allowSameFolder: true`) — diferente do mobile,
  aqui um import relativo (`../../foo`) fora da mesma pasta falha no lint.
- Estilização é Tailwind CSS + `@material-tailwind/react`; os design tokens ficam em `src/util`
  (`Tokens`, referenciado por `src/types/index.ts` pra `TFontSize`/`TColor`/etc.). i18n via
  `i18next`/`react-i18next`.
- `@casl/ability` está instalado mas ainda não está integrado em nenhum componente — não existe lógica
  de permissão/ability ainda, caso você procure por isso.
- `src/types/index.ts` reexporta tudo de `@myfinance/shared` junto com os tipos próprios de UI deste
  app (`IPath`, `ITypographyStyle`, `TFontSize`, etc.) — tipos de domínio/API e tipos de UI são ambos
  importados de `@/types` neste app.

## Convenções deste repositório

- READMEs e este `CLAUDE.md` são escritos inteiramente em português.
- Mensagens de commit são escritas em português.
