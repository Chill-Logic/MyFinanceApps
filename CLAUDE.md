# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Estrutura do repositório

Monorepo com npm workspaces (sem pnpm/yarn, sem Turborepo) com dois apps que compartilham o mesmo backend:

```
apps/mobile/     @myfinance/mobile — app React Native + Expo (SDK 57, Continuous Native Generation)
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
npm run mobile:start        # expo start --clear
npm run mobile:android      # expo run:android (builda nativo + instala + abre)
npm run mobile:ios
npm run mobile:lint
npm run mobile:test         # jest
npm run mobile:typecheck    # tsc --noEmit (não existe script equivalente dentro do app)
npm run mobile:build        # eas build --platform android --profile production
npm run mobile:build:submit # o mesmo build + eas submit automático (track de teste interno)

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

**Atualizado em 2026-07-06**: `env.ts`/`env.d.ts`/`react-native-dotenv` foram removidos. A API URL
agora é `process.env.EXPO_PUBLIC_API_URL` (suporte nativo do Metro/`babel-preset-expo` a variáveis
`EXPO_PUBLIC_*` — nenhuma lib extra necessária). Localmente, vem de `apps/mobile/.env` (gitignored,
não existe num clone novo — copie de `.env.example`). Em produção, vem de uma **EAS Environment
Variable** (`npx eas-cli env:list production`), injetada automaticamente durante `eas build`/
`eas update --environment production` — não precisa de nenhum passo manual no CD pra isso.
Motivo da migração: o `env.ts` manual funcionava bem localmente, mas não existia (por ser gitignored)
no checkout limpo do GitHub Actions, quebrando o CD (`Unable to resolve module ../../../../env`); um
`.easignore` chegou a ser tentado pra forçar a inclusão desse arquivo no pacote do EAS Build, mas não
resolveu (o build remoto seguia sem o arquivo) — trocar pra env var nativa do Expo eliminou o problema
na raiz em vez de continuar contornando.

### Build nativo local (mobile, pós-Expo)

`apps/mobile/android/` e `apps/mobile/ios/` **não são versionados** — são gerados via Continuous Native
Generation (`npx expo prebuild --platform android`, disparado automaticamente também por
`npm run mobile:android` / `expo run:android` se a pasta não existir). Isso significa que, numa máquina
nova (ou depois de apagar `android/` de propósito), alguns arquivos específicos da máquina somem e
precisam ser recriados:
- `android/local.properties` (`sdk.dir=...`, aponta pro Android SDK local) — não é gerado pelo
  `prebuild`. Sem ele o Gradle falha com `SDK location not found`. Abrir o projeto uma vez no Android
  Studio cria esse arquivo sozinho; senão, crie à mão com `sdk.dir=<caminho do Android SDK>` (Windows:
  tipicamente `C:\Users\<usuário>\AppData\Local\Android\Sdk`), ou configure a variável de ambiente
  `ANDROID_HOME`/`ANDROID_SDK_ROOT` do Windows (essa sim sobrevive a qualquer prebuild futuro, em vez de
  precisar recriar o arquivo toda vez).
- Keystore de release (`my-release-key.keystore`) e `release.properties`, além do bloco
  `signingConfigs.release` no `build.gradle` que os usa — ver "Migração pro Expo SDK 57" na seção de
  Arquitetura abaixo.

## Arquitetura

### apps/mobile (React Native + Expo SDK 57)

RN passou por uma migração faseada até o Expo, feita nesta ordem (todas em 2026-07):
`0.79 → 0.80 → 0.83 → 0.86` (upgrade puro de RN) `→ Expo SDK 57` (migração pro Expo, CNG). Metodologia
usada em todas as etapas do upgrade de RN: comparar arquivo-a-arquivo com o template oficial do
[rn-diff-purge](https://github.com/react-native-community/rn-diff-purge) (`RnDiffApp/` na tag
`release/<versão>`) antes de aplicar qualquer coisa — isso evita reaplicar patches de monorepo
desnecessariamente e mostra exatamente o que realmente mudou.

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
- **Bug de versionamento dentro do próprio RN 0.83.x** (histórico, já não se aplica a partir da 0.86):
  `@react-native/babel-preset` fixava `babel-plugin-syntax-hermes-parser@0.32.0` em todos os patches
  0.83.x, mas o `metro` já usava `hermes-parser@0.35.0` internamente — o parser do Babel (0.32.0) não
  reconhecia a sintaxe `match` que o próprio código-fonte do RN 0.83 já usa internamente
  (`VirtualView.js`), dando `SyntaxError` no bundle do Metro. Corrigimos com `overrides` na raiz
  forçando `hermes-parser`/`babel-plugin-syntax-hermes-parser` pra `0.35.0`. **Na 0.86 o próprio
  `@react-native/babel-preset` já pede `0.36.0` (alinhado com o resto), então removemos o override** —
  se reaparecer um mismatch parecido numa versão futura, cheque se ainda precisa de um override antes
  de simplesmente atualizar o valor fixo; pode ser que o upstream já tenha corrigido sozinho.
- RN 0.86 rodou limpo sem nenhum outro ajuste: mesmo `screens@4.16.0` da etapa anterior continuou
  funcionando (não precisou reavaliar), Gradle wrapper só subiu de patch (`9.0.0 → 9.3.1`, dentro do
  mesmo major), e `compileSdk`/`targetSdk`/`kotlinVersion` ficaram inalterados. `engines.node` do
  template oficial subiu pra `>= 22.11.0` (Node instalado aqui já era v24, sem impacto prático).
- **Depois de qualquer mudança grande de dependência nativa, reinicie o Metro com cache limpo**
  (`npm run mobile:start`, que já roda com `--reset-cache`) — ele cacheia módulos transformados e não
  necessariamente percebe que o conteúdo dentro de `node_modules` mudou só porque a versão no
  `package.json` mudou. Os erros de `VirtualView.js`/`insetType` acima reapareceram idênticos depois de
  já estarem corrigidos, simplesmente porque o Metro de uma sessão anterior continuava rodando com
  cache antigo.

**Migração pro Expo SDK 57** (depois do upgrade de RN acima, mesmo mês): trocou
`react-native-vector-icons` → `@expo/vector-icons` e `@react-native-community/checkbox` →
`expo-checkbox` (permite rodar em Expo Go puro, sem Development Build, no dia a dia), `babel.config.js`
→ `babel-preset-expo`, `metro.config.js` → `expo/metro-config` (resolve hoisting de monorepo sozinho
desde o SDK 52, não precisa mais do `watchFolders`/`nodeModulesPaths` manual), `index.js` →
`registerRootComponent` do pacote `expo`. Rodar `npx expo install --check`/`--fix` depois de qualquer
mudança de dependência nativa vira o novo jeito de manter as libs alinhadas com a versão do SDK (substitui
o pin manual por versão exata que fazíamos durante o upgrade de RN puro — inclusive resolveu o
`react-native-screens`, que subiu de `4.16.0` pra `4.25.2`, a versão que tinha o bug do `insetType` com RN
0.83 mas que já é segura agora com RN 0.86/SDK 57).

Depois disso veio o `npx expo prebuild --platform android` (Continuous Native Generation — regenera
`android/`/`ios/` do zero a partir do `app.json`; essas pastas **não são mais versionadas**, ver seção
"Build nativo local" acima). Armadilhas encontradas nesse processo, prováveis de reaparecer se o
`app.json` for reestruturado no futuro:
- **`app.json`: `android.usesCleartextTraffic` não existe** como campo nativo do schema do Expo (mesmo
  parecendo razoável) — só teve efeito depois de mover pra dentro do plugin `expo-build-properties`
  (`plugins: [["expo-build-properties", { android: { usesCleartextTraffic: true } }]]`). Sem isso, o
  `AndroidManifest.xml` gerado simplesmente não ganha o atributo, silenciosamente.
- **`app.json`: o ícone não pode apontar pra um arquivo dentro de `android/`** (ex:
  `./android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`, que era o placeholder usado antes do
  prebuild) — o primeiro passo do `prebuild` é limpar `android/` inteiro, então o arquivo fonte deixa de
  existir bem antes da etapa que gera os ícones a partir dele (`ENOENT`). O ícone fonte precisa morar em
  algum lugar estável fora de `android/`/`ios/`, ex. `apps/mobile/assets/icon.png`.
- **`userInterfaceStyle: "automatic"`** precisa do pacote `expo-system-ui` instalado, senão o prebuild só
  avisa e ignora a opção (não dá erro, só não aplica).
- **`MainActivity.kt` gerado agora usa `getMainComponentName() = "main"`**, compatível com
  `registerRootComponent` (que sempre registra como `"main"`). Antes do prebuild, o `MainActivity.kt` do
  RN CLI antigo esperava `"MyFinance"` — rodar `expo run:android`/build nativo real **antes** do prebuild
  quebra com "Unable to find main component". Só testar via Expo Go (que não usa `android/` nenhuma)
  funciona nesse meio-tempo.
- **O template de `build.gradle` gerado pelo prebuild não tem `signingConfigs.release` nenhum** — o
  `buildTypes.release` usa `signingConfigs.debug` por padrão. A keystore de produção
  (`android/app/my-release-key.keystore`) e o `release.properties` (mesmo caminho, `android/app/`, dessa
  vez sem o mismatch de path que tínhamos antes do Expo) foram restaurados no lugar, mas o bloco de
  `signingConfigs.release` que lia esse arquivo **precisa ser readicionado manualmente toda vez que o
  prebuild regenerar `build.gradle` do zero** — não sobrevive ao CNG sozinho. Isso não bloqueia builds de
  debug (usados pra validar a migração). O caminho recomendado — e já configurado neste repo — é o
  **EAS Build**: `apps/mobile/eas.json` tem os perfis `development`/`preview`/`production`
  (`appVersionSource: "remote"`, com `autoIncrement` no perfil `production` — o `versionCode` não mora
  mais no `app.json`, é controlado pelo EAS; use `npx eas-cli build:version:get/set -p android` pra
  consultar/ajustar). A keystore de produção já foi enviada pro credential manager do EAS (conta pessoal
  `csjhonathan`, projeto `myfinance`) — conferido que bate com o fingerprint de **upload key** da Play
  Console (Play App Signing está ativo, então é o upload key que precisa bater, não o app signing key).
  **EAS Submit** também está configurado (`eas.json` → `submit.production.android`, aponta pra
  `apps/mobile/google-service-account.json`, gitignored — chave de uma conta de serviço do Google Cloud
  com permissão **apenas** de "Liberar apps para as faixas de teste" na Play Console, propositalmente sem
  acesso a produção): `eas build --platform android --profile production --auto-submit` builda e já sobe
  pra track de teste interno sozinho.
- **CD automático está implementado** em `.github/workflows/mobile-cd.yml`. Dispara só em **PR mesclado**
  na `main` que mexeu em `apps/mobile/**` (evento `pull_request: closed` + `if: merged == true` — nunca
  em push solto, que é um evento diferente). Dois jobs:
  - `decide`: calcula o fingerprint do commit mesclado (`npx eas-cli fingerprint:compare --build-id
    <último build finished do channel production>`) e decide se um update JS-only (OTA) basta, ou se
    precisa de build nativo — mesma lógica do "EAS Update" descrita abaixo.
  - `publish`: atrás de um **gate de aprovação manual** (`environment: production` — precisa configurar
    esse Environment em Settings → Environments do GitHub, com "Required reviewers" marcado; não é algo
    que dá pra versionar em arquivo). Publica `eas update` (canal `production`) ou
    `eas build --auto-submit`, dependendo da decisão do job anterior.
  - Precisa de dois secrets no repo (`Settings → Secrets and variables → Actions`): `EXPO_TOKEN` (gerado
    em expo.dev → Access Tokens) e `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (o
    `apps/mobile/google-service-account.json` em base64, decodificado de volta pro arquivo dentro do
    job `publish`).
  - Se não existir nenhum build `finished` no canal `production` ainda, o job `decide` força build nativo
    (não assume OTA sem ter uma baseline confiável pra comparar).
  - **Observação (2026-07-06)**: o `eas fingerprint:generate`/`compare` local já mostrou um resultado
    "diferente" isolado, uma única vez, num teste manual onde nada de nativo tinha mudado de verdade
    (não reproduzido em 4 tentativas seguidas depois) — possível flutuação por cache/processo em segundo
    plano. Não é perigoso pro CD: o pior caso é disparar um build nativo desnecessário à toa (gasta
    minutos), nunca aplicar um OTA incompatível, já que a lógica só assume OTA quando os hashes batem
    exatamente. Se o CD parecer "nervoso" (build nativo disparando com frequência maior que o esperado
    pra mudanças que são só JS), comece a investigação por aqui.
- **EAS Update (OTA) está configurado** (`expo-updates` instalado, `npx eas-cli update:configure`
  rodado): `app.json` tem `updates.url` e `runtimeVersion: { policy: "appVersion" }`; cada perfil do
  `eas.json` (`development`/`preview`/`production`) ganhou um `channel` de mesmo nome. Só funciona pra
  mudança **100% JS** — qualquer coisa nativa (lib nova, upgrade de SDK do Expo, permissão/config nativa)
  ainda exige um build normal (`npm run mobile:build`/`mobile:build:submit`).
  - **`runtimeVersion: "appVersion"` significa que a compatibilidade do OTA é amarrada ao campo
    `version` do `app.json`** — não ao `versionCode`. Isso exige disciplina manual: **toda vez que uma
    mudança nativa for feita, bump o `version`** (ex: `0.1.0` → `0.2.0`), senão o EAS pode tentar aplicar
    um update OTA feito pra um runtime novo em cima de um binário nativo antigo incompatível. Builds
    feitos antes de instalar o `expo-updates` (ex: o primeiro submetido nesta migração, `versionCode 11`,
    `version 0.0.9`) não têm a capacidade de receber OTA — só builds novos, feitos depois dessa
    configuração, são "OTA-ready".
  - Publicar um update: `npm run mobile:ota:production -- -m "mensagem do update"` (o `-m` é obrigatório
    pelo `eas update`; passe depois de `--` pro npm repassar o argumento pro script de dentro do
    workspace). Publica no canal `production`, que só chega em builds nativos que também foram feitos com
    `channel: "production"` (perfil `production` do `eas.json`).
  - `src/components/organisms/Sidebar/index.tsx` mostra a versão do app lendo
    `Constants.expoConfig?.version` (de `expo-constants`) — **não** o `version` do `package.json` (que
    existe só por convenção do npm/workspace, mas não é o que aparece pro usuário nem o que o
    `runtimeVersion` usa).

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
- `metro.config.js` é só `getDefaultConfig(__dirname)` de `expo/metro-config` — desde o SDK 52 ele já
  resolve hoisting de monorepo (workspaces, `node_modules` da raiz) sozinho, sem precisar declarar
  `watchFolders`/`resolver.nodeModulesPaths` à mão como fazíamos antes do Expo.
- `tsconfig.json` estende `@react-native/typescript-config` e sobrescreve `typeRoots` pra incluir
  explicitamente o `node_modules/@types` hoisted na raiz (`../../node_modules/@types`) — necessário
  porque o npm hoisteia a maioria dos pacotes `@types/*` pra raiz do repo em vez de
  `apps/mobile/node_modules`.
- `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`,
  `react-native-worklets` e `typescript` são mantidos alinhados à versão que `npx expo install --check`
  espera pro SDK instalado (rode `npx expo install --fix` depois de qualquer mudança nessas
  dependências) — isso substituiu o pin manual por versão exata que fazíamos durante o upgrade de RN
  puro. `@tanstack/react-query` continua fixado à mão em `5.80.6` (fora do radar do `expo install`,
  já que não é uma lib nativa) — versões 5.x mais novas degradam silenciosamente os genéricos de
  `useQuery`/`useMutation` pra `any` sob a versão de TypeScript deste projeto. Não solte esse range de
  volta pra `^` sem checar compatibilidade de tipos antes.
- **Build Android nativo no monorepo (histórico, pré-Expo)**: o Gradle não sabe nada sobre hoisting de
  workspace — qualquer caminho relativo hardcoded pro `node_modules` que assumia
  `apps/mobile/node_modules/...` quebra quando o pacote sobe pra raiz do monorepo. Isso foi relevante
  enquanto `android/` era versionado e mantido à mão; agora que o Expo prebuild regenera essa pasta do
  zero a cada vez (ver "Migração pro Expo SDK 57" acima), os pontos abaixo já não existem mais nos
  arquivos gerados (o plugin Gradle do Expo resolve isso sozinho) — mantidos aqui só como referência
  caso outra lib nativa volte a hardcodear caminho relativo de `node_modules` no futuro:
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
  - `react-native-vector-icons` foi removido na migração pro Expo (trocado por `@expo/vector-icons`,
    que não precisa desse tipo de override), então o item de fontes acima também deixou de existir.
- `android/app/src/main/res/values/styles.xml` tinha `android:forceDarkAllowed="false"` no `AppTheme`
  antes do Expo prebuild (evita o Android "consertar" contraste sozinho em builds API 29+) — **não foi a
  causa** de um artefato visual parecido que encontramos (ver o ponto do `ThemedView` acima). O template
  gerado pelo Expo prebuild não declara esse atributo; se algum artefato visual parecido reaparecer em
  builds novos, esse é o primeiro lugar a checar.

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
