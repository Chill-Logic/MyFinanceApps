# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Estrutura do repositório

Monorepo com npm workspaces (sem pnpm/yarn, sem Turborepo) com dois apps que compartilham o mesmo backend:

```
apps/mobile/     @myfinance/mobile — app React Native (RN CLI puro, sem Expo)
apps/web/        @myfinance/web    — app web em Vite + React
packages/shared/ @myfinance/shared — tipos de domínio, contratos de API e rotas do backend, compartilhados
```

`packages/shared` é a única fonte de verdade pra qualquer coisa que descreva o contrato com o backend
e pra lógica que não depende de plataforma:
- `models.ts` — entidades de domínio (`TUser`, `TTransaction`, `TWallet`, `TInvite`)
- `api.ts` — tipos de request/response + `TMutationParams`
- `routes.ts` — `API_ROUTES`, o mapa de endpoints
- `queryKeys.ts` — `QUERY_KEYS`, as chaves de cache do React Query
- `fetchers/*.ts` — funções puras `(axios, params?) => Promise<T>` que batem no endpoint certo com o
  tipo certo (uma por operação: `signIn`, `indexWallets`, `createTransaction`, etc.). Os hooks de cada
  app só chamam essas funções, passando a instância de axios da própria plataforma — a lógica de "qual
  endpoint, qual payload, qual tipo de retorno" mora só aqui.
- `utils/` — `DateUtils`, `MoneyUtils`, `TextUtils`: formatação pura, sem dependência de plataforma.
- `tokens.ts` — design tokens da marca: `colors` (paleta flat, chaves hifenizadas de propósito — são
  consumidas literalmente como classes Tailwind no web, ex. `colors['background-light']` vira
  `bg-background-light`; não normalize pra camelCase), `spacing`, `borderRadius`, `fontSize`,
  `fontWeight`, e `Theme.light`/`Theme.dark` (papéis semânticos: `text`, `background`, `border`,
  `placeholder`, `error`, no formato que o `context/theme.tsx` do mobile consome). `fontFamily` fica
  só em `apps/web/src/util/tokens.ts` — depende de arquivos de fonte carregados só no web.

Os dois apps importam `packages/shared` como uma dependência de workspace comum (sem etapa de build —
o Metro e o Vite consomem o TypeScript fonte diretamente). Ao adicionar ou mudar algo do contrato com
o backend, um fetcher, uma query key ou um formatter, edite ali uma única vez; não redefina equivalentes
localmente em nenhum dos apps.

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
  (ex: `hooks/api/transactions/useCreateTransactions`). Cada hook é um wrapper fino: obtém uma
  instância do axios via `hooks/api/useAxiosInstance` (`getAxiosInstance()` lê o token de autenticação
  do `LocalStorage` e injeta `Authorization: Bearer <token>`) e chama o fetcher correspondente de
  `@myfinance/shared` (`signIn`, `indexWallets`, `createTransaction`, etc.) dentro do `queryFn`/
  `mutationFn` do TanStack Query. O hook não sabe qual é o endpoint nem monta o payload — isso é
  responsabilidade do fetcher em `packages/shared/src/fetchers`. `QUERY_KEYS` também vem de
  `@myfinance/shared`.
- `src/services/storage` encapsula o `AsyncStorage` com um prefixo de chave próprio do app
  (`LocalStorage`).
- `src/components` segue o padrão atoms/organisms; `src/types/forms.ts`, `screen.ts` e `storage.ts`
  são específicos do mobile (formato de campos de formulário, tipos de parâmetros de navegação, chaves
  de storage) e não são compartilhados com o web.
- Formatação de data/dinheiro/texto usa `DateUtils`/`MoneyUtils`/`TextUtils` de `@myfinance/shared`
  (`src/utils/*.ts` no mobile são só re-export desses). `DateUtils` usa `date-fns` por baixo — nenhum
  código de app deve importar `date-fns` diretamente, só o helper compartilhado. Não existe mais
  `moment` no projeto (foi removido dos dois apps).
- O tema real do mobile é `src/context/theme.tsx` (`ThemeProvider`/`useTheme()`), consumido por
  `ThemedText`, `ThemedView`, `Loader`, `ThemedTextInput`, `SelectInput`, `Dropdown` via
  `src/hooks/useThemeColor.ts`. `lightTheme`/`darkTheme` vêm de `Theme.light`/`Theme.dark` de
  `@myfinance/shared` (mesma paleta de marca do web); `useThemeColor` detecta modo escuro comparando
  com `Theme.dark.background` — não hardcode esse valor de novo. `ThemeProvider` hoje só usa
  `darkTheme` (não existe alternância light/dark implementada, só os dois temas disponíveis).
  `src/constants/Colors.ts` (o placeholder padrão do template RN, formato diferente e nunca usado) foi
  removido.
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

- A entrada `src/App.tsx` envolve o `Router` (de `src/router`) num `QueryClientProvider` do
  `@tanstack/react-query`, mesma versão pinada do mobile (`5.80.6`) — os dois apps estão alinhados
  aqui. Ainda não existe nenhuma tela no web consumindo dados via hook; quando isso começar, use os
  fetchers de `@myfinance/shared` (ver seção do mobile acima) em vez de bater no axios direto.
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
- `tsconfig.json` usa `"moduleResolution": "bundler"` (o comentário `/* Bundler mode */` já indicava
  isso, mas por herança de um template antigo do Vite estava como `"node"` — cuidado se algum dia
  reaparecer). Com `"node"`, a resolução de pacotes com `exports` condicional no `package.json` (como o
  `axios`) fica inconsistente e pode quebrar tipos de forma difícil de rastrear.
- O `tsconfig.json` não restringe `"types"` (ao contrário do mobile, que herda `"types": ["react-native",
  "jest"]` do `@react-native/typescript-config`) — qualquer pacote `@types/*` hoisted na raiz do
  monorepo entra ambientalmente no programa do TypeScript aqui. Já mordemos isso uma vez: um
  `@types/axios` obsoleto (dependência esquecida do mobile, de quando o axios não vinha com tipos
  próprios) vazava pro web e sobrescrevia `AxiosInstance`. Não reintroduza `@types/axios` nem outros
  stubs de tipos de pacotes que já publicam seus próprios `.d.ts`.

## Convenções deste repositório

- READMEs e este `CLAUDE.md` são escritos inteiramente em português.
- Mensagens de commit são escritas em português.
