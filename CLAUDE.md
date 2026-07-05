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

RN está em migração faseada até o Expo (rodando hoje: `0.83.10`). Ordem combinada: `0.79 → 0.80` (feito)
`→ 0.83` (feito, 2026-07) `→ 0.86 → Expo SDK 57`. Metodologia usada nas duas etapas: comparar
arquivo-a-arquivo com o template oficial do
[rn-diff-purge](https://github.com/react-native-community/rn-diff-purge) (`RnDiffApp/` na tag
`release/<versão>`) antes de aplicar qualquer coisa — isso evita reaplicar patches de monorepo
desnecessariamente e mostra exatamente o que realmente mudou. Refaça essa comparação a cada etapa
futura, não assuma que vai ser tão leve quanto 0.79→0.80.

0.79→0.80 mudou só `kotlinVersion` (2.0.21→2.1.20) e o Gradle wrapper (8.13→8.14.1). 0.80→0.83 foi bem
mais denso — problemas encontrados e como foram resolvidos, prováveis de reaparecer em upgrades
futuros:
- **`tsconfig.json` do mobile**: `"extends": "@react-native/typescript-config/tsconfig.json"` (com
  subpath explícito) parou de funcionar silenciosamente — a partir da 0.83 o pacote passou a declarar
  `"exports"` no `package.json` só liberando `"."` e `"./strict"`, bloqueando o subpath `/tsconfig.json`
  literal. O `extends` não dava erro, só deixava de herdar `jsx`/`esModuleInterop`/etc., causando uma
  cascata de erros de JSX. Fix: `"extends": "@react-native/typescript-config"` (sem subpath, igual o
  template oficial já usa).
- **`eslint-plugin-jest` não resolvia** (`Environment key "jest/globals" is unknown"`): o
  `@react-native/eslint-config@0.83.10` passou a depender de `eslint-plugin-jest`, mas só como
  dependência aninhada dentro do próprio pacote — a resolução de plugin do ESLint legado não achava
  dali no contexto do monorepo. Fix: declarar `eslint-plugin-jest` como devDependency direta do
  `apps/mobile`.
- Isso, por sua vez, criou um conflito de peer: `eslint-plugin-jest` quer `@typescript-eslint/eslint-plugin@^8`,
  mas o `apps/web` já tem `^6.8.0` pro próprio lint. Resolvido com um `overrides` aninhado na raiz do
  monorepo (`package.json`) forçando `eslint-plugin-jest` a usar sua própria cópia do `^8.0.0`, sem
  mexer na versão que o web usa.
- **`@typescript-eslint/member-delimiter-style` sumiu** ("rule not found"): essa regra foi deprecada e
  removida do `@typescript-eslint/eslint-plugin` a partir da v8 (que veio transitivamente com o
  `@react-native/eslint-config@0.83.10`) — a substituta é `@stylistic/ts/member-delimiter-style`
  (mesmas opções), já que o `@stylistic/eslint-plugin-ts` já estava instalado.
- **`react-router-dom` (web) quebrou o typecheck de JSX** depois do bump de TypeScript pra `5.8.3`: o
  hoisting do npm deduplicou o `react` interno do `react-router`/`react-router-dom` pro React 19 do
  mobile (peer bem aberto, `>=16.8`, satisfeito por qualquer um dos dois), em vez do React 18 real do
  web — misturando os tipos de `ReactNode`/`ReactPortal` de versões diferentes. Resolvido com
  `overrides` na raiz forçando `react-router`/`react-router-dom` a usar `react: 18.3.1`. Se outro
  pacote do web (não do mobile) começar a dar erro de JSX parecido depois de mexer em dependências,
  suspeite do mesmo tipo de dedupe cruzado entre os dois React majors do monorepo.
- `@types/react-router-dom@^5.1.9` era outro resquício obsoleto (tipos da v5, mas o pacote instalado é
  v6, que já vem com tipos próprios) — removido, mesma categoria do `@types/axios`/`@types/date-fns`
  já limpos antes.
- `react-native-reanimated` foi de `4.0.1` para `4.5.1` (compatível com RN `0.83 - 0.86`, então não
  precisa bumpar de novo na próxima etapa) e `react-native-worklets` de `^0.4.1` pra `0.10.1` exato
  (par obrigatório do reanimated 4.5.x).
- **`react-native-screens` precisou de bump de verdade**, e isso **não aparece em typecheck/lint
  nenhum** — só estoura na compilação/bundle nativo. `4.11.1` referenciava uma classe interna do RN
  (`CSSBackgroundDrawable`) que mudou entre 0.80 e 0.83 (`Unresolved reference` no Kotlin durante
  `compileDebugKotlin`). A versão mais nova na época (`4.25.2`) resolvia isso, mas introduziu outro
  problema: seu componente Fabric `SafeAreaViewNativeComponent.ts` (feature de safe area pra Android
  Tabs, adicionada em set/2025) usa um prop (`insetType`) que o codegen do RN 0.83 não reconhece
  (`Unknown prop type ... "undefined"` no bundle do Metro). Fixamos em **`4.16.0`** (set/2025, antes
  dessa feature existir, mas depois do fix do `CSSBackgroundDrawable`) — janela estreita entre dois
  bugs de versões diferentes. Se subir esse pacote de novo no futuro, cheque primeiro se uma versão
  mais nova corrigiu o bug do `insetType`, não assuma que "mais novo é mais seguro" aqui.
  `react-native-gesture-handler` e `react-native-safe-area-context` não precisaram de bump manual
  porque já estavam com range `^` (resolveram sozinhos pra `2.32.0`/`5.8.0` no `npm install`) —
  `screens` só ficou preso porque tinha sido fixado sem `^` numa etapa anterior. Ao subir a próxima
  versão do RN, não assuma que nenhuma lib nativa precisa de bump só porque o typecheck passou — o
  build Android real é a única validação confiável pra isso.
- Gradle `8.14.1 → 9.0.0` (major) e `compileSdk`/`targetSdk`/`buildToolsVersion` `35 → 36` — compilou de
  primeira, sem precisar de ajuste (os warnings de "deprecated Gradle features" dos builds anteriores
  não viraram erro).
- **Bug de versionamento dentro do próprio RN 0.83.x**: `@react-native/babel-preset` fixa
  `babel-plugin-syntax-hermes-parser@0.32.0` em todos os patches 0.83.x, mas o `metro` já usa
  `hermes-parser@0.35.0` internamente — o parser do Babel (0.32.0) não reconhece a sintaxe `match` que
  o próprio código-fonte do RN 0.83 já usa internamente (`VirtualView.js`), dando `SyntaxError` no bundle
  do Metro. Corrigido com `overrides` na raiz forçando `hermes-parser`/`babel-plugin-syntax-hermes-parser`
  pra `0.35.0` em toda a árvore.
- **Depois de qualquer mudança grande de dependência nativa, reinicie o Metro com cache limpo**
  (`npm run mobile:start`, que já roda com `--reset-cache`) — ele cacheia módulos transformados e não
  necessariamente percebe que o conteúdo dentro de `node_modules` mudou só porque a versão no
  `package.json` mudou. Os erros de `VirtualView.js`/`insetType` acima reapareceram idênticos depois de
  já estarem corrigidos, simplesmente porque o Metro de uma sessão anterior continuava rodando com
  cache antigo.

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
- `ThemedView` (`src/components/atoms/ThemedView.tsx`) **sempre** pinta o próprio `backgroundColor` com
  a cor do tema, a não ser que o `style` passado sobrescreva — ele não é "transparente por padrão". Um
  `<ThemedView>` sem `style` aninhado dentro de outro container já colorido pinta um retângulo opaco do
  tamanho do próprio conteúdo por cima (ficou invisível enquanto as duas cores eram quase iguais
  `#121212`/`#121214`; virou um artefato visual visível assim que a paleta mudou pra navy). Se usar
  `ThemedView` só como agrupador de layout dentro de algo que já tem fundo, passe
  `style={{ backgroundColor: 'transparent' }}` (ver `TransactionList`, style `transactionLeft`).
- Cor de ação/marca (botões primários, checkbox "manter logado", badge de convites): use
  `colors['brand-secondary']` de `@myfinance/shared` (verde). Havia um roxo hardcoded (`#A328D6`)
  espalhado em ~9 arquivos sem nenhuma relação com o tema, antigo ou novo — se aparecer de novo em
  algum componente novo, é resquício do branding antigo, troque pelo token.
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
- **Build Android nativo no monorepo**: o Gradle não sabe nada sobre hoisting de workspace — qualquer
  caminho relativo hardcoded pro `node_modules` que assumia `apps/mobile/node_modules/...` quebra
  quando o pacote sobe pra raiz do monorepo. Já corrigimos três pontos (confirmados rodando
  `assembleDebug`/`installDebug` de verdade, não só typecheck):
  - `android/settings.gradle`: `pluginManagement { includeBuild(...) }` e o `includeBuild(...)` do
    `@react-native/gradle-plugin` apontam pra `../../../node_modules/@react-native/gradle-plugin`
    (raiz do monorepo), não `../node_modules/...`. Repare que dentro do bloco `pluginManagement {}` o
    Gradle roda num contexto restrito — resolver o caminho dinamicamente via Node (`.execute()`) não
    funcionou ali; caminho relativo literal foi o que funcionou de forma confiável.
  - `android/app/build.gradle`: o bloco `react { }` tem `reactNativeDir`/`codegenDir`/`cliFile`
    descomentados e apontando pra `../../../../node_modules/react-native` (o default comentado assume
    `../../node_modules/react-native`, local). Sem isso, o Gradle falha tentando ler
    `apps/mobile/node_modules/react-native/ReactAndroid/gradle.properties`, que não existe.
  - Fontes do `react-native-vector-icons` (ícones viram caixinhas com "X" sem isso): o próprio
    `fonts.gradle` da lib tem um `iconFontsDir` hardcoded relativo (`../../node_modules/.../Fonts`) que
    também assume node_modules local. A lib já prevê um override via `project.ext.vectoricons` — é
    isso que está declarado em `android/app/build.gradle` logo antes do `apply from:` do
    `fonts.gradle`. Sem esse override, a task `copyReactNativeVectorIconFonts` roda como `NO-SOURCE` e
    nenhuma fonte é empacotada no app.
  - Esses três pontos precisam ser reconferidos manualmente sempre que o Upgrade Helper do React
    Native (ou uma futura migração pro Expo) regenerar `settings.gradle`/`app/build.gradle` do zero —
    o diff oficial não sabe que isso é um monorepo.
- `android/app/src/main/res/values/styles.xml` tem `android:forceDarkAllowed="false"` no `AppTheme`
  (que estende `Theme.AppCompat.DayNight.NoActionBar`). Sem isso, o Android tenta "consertar" contraste
  sozinho em builds API 29+ — mas isso **não foi a causa** de um artefato visual parecido que
  encontramos (ver o ponto do `ThemedView` acima); vale manter o `forceDarkAllowed=false` de qualquer
  forma já que o app gerencia o próprio tema em JS e nunca declarou suporte real a light/dark pro
  Android (não existe pasta `values-night`).

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
- `eslint-rule-composer` é uma devDependency direta aqui mesmo sem nenhum código do repo importar
  dela — é uma dependência real de `eslint-plugin-unused-imports@3.2.0` (a versão que o web usa; o
  mobile usa a v4, que não precisa dela) que o npm, no contexto do monorepo, não estava instalando
  sozinho de forma confiável (mesma categoria de bug de resolução aninhada que já vimos com
  `eslint-plugin-jest` no mobile). Se o lint do web começar a falhar com
  `Cannot find module 'eslint-rule-composer'`, não é regressão de código — é essa dependência sumindo
  de novo depois de um `npm install` do zero; reinstale/declare explicitamente de novo.

## Convenções deste repositório

- READMEs e este `CLAUDE.md` são escritos inteiramente em português.
- Mensagens de commit são escritas em português.
