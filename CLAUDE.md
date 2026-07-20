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
  - `publish`: roda automaticamente logo após o `decide`, sem aprovação manual. Publica `eas update`
    (canal `production`) ou `eas build --auto-submit`, dependendo da decisão do job anterior.
    **Histórico**: já teve um `environment: production` aqui (gate de aprovação manual via um Environment
    do GitHub com "Required reviewers"), removido a pedido — publicação é totalmente automática agora. Se
    algum dia quiser o gate de volta, é só readicionar `environment: production` ao job e configurar o
    Environment em Settings → Environments (não dá pra versionar o "Required reviewers" em arquivo). Os
    secrets abaixo são de repositório, não do Environment, então continuam funcionando com ou sem o gate.
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
  - **`npx expo install --check` não detecta cópias duplicadas de uma dependência nativa** — só compara
    a versão declarada no `package.json` contra o range oficial do SDK, não o que de fato está instalado
    em `node_modules`. Já aconteceu de `apps/mobile/package.json` fixar `react-native-reanimated`/
    `react-native-worklets` numa versão EXATA (`4.5.0`/`0.10.0`) enquanto outra dependência (instalada
    via `npx expo install <pacote>`, que também pode ajustar peers) puxava uma versão mais nova
    (`4.5.1`/`0.10.1`) pra raiz do monorepo — como o pin era exato, o npm não conseguiu unificar as duas
    e criou uma cópia aninhada dentro de `apps/mobile/node_modules` com a versão antiga, deixando o
    Metro (que resolve a partir de `apps/mobile`) rodando com uma versão diferente da que o binário
    nativo tinha compilado. Sintoma: nenhum erro, só comportamento nativo silenciosamente quebrado (ver
    a entrada do `BottomSheetModal` na seção de navegação, mais acima). Diagnóstico: comparar
    `require('./node_modules/<pacote>/package.json').version` na raiz contra
    `require('./apps/mobile/node_modules/<pacote>/package.json').version` (se a segunda pasta existir,
    já é o sinal do problema). Fix: alinhar a versão exata do `apps/mobile/package.json` com a que ficou
    na raiz e rodar `npm install` de novo — colapsa as duas cópias em uma só.
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

**Port das melhorias de navegação/transações do apps/web pro mobile** (2026-07-07): depois de construir
bottom nav, layout com header fixo e UX de transações no web, essas peças foram portadas pro mobile —
adaptadas, não copiadas 1:1, já que aqui não existe a dualidade desktop/mobile que o web tem.
- **`components/organisms/BottomNav`** (novo) — **substitui o `Header` (nome da carteira + engrenagem
  de configurações + logout) e o `Sidebar` em drawer lateral que existiam antes**, ambos removidos
  (`organisms/Header` e `organisms/Sidebar` deletados por completo, não sobrou nada usando eles). 5
  posições, igual o web: Início, Convites, FAB central elevado (Nova Transação, só na Home), Carteiras,
  e um 5º botão de hambúrguer — a primeira versão desse port tinha ficado só com 3 destinos + FAB,
  assumindo (errado) que o hambúrguer do `Header` antigo já cobria a função; como o `Header` também
  precisava sumir (o web não tem nada equivalente fixo no topo), essa lacuna só apareceu depois. Nasce
  **docked** desde o início (o web só chegou nesse formato depois de reverter uma versão flutuante que
  escondia a última transação da lista — aqui não reproduzimos esse erro).
  - `hooks/useNavItems.ts` (novo) espelha a mesma FORMA do equivalente em `apps/web`
    (`hooks/useNavItems`), só troca `useLocation()` do react-router-dom por `useNavigationState()` do
    React Navigation. Não portamos `newWalletAction`: no mobile "Nova Carteira" já é um fluxo real
    (`WalletFormModal`), diferente do placeholder ("Em breve") que o web ainda tem.
  - `context/newTransactionDialog.tsx` (novo, mesmo padrão do web) sincroniza o FAB da `BottomNav`
    (vive no `AuthenticatedLayout`) com o modal de nova transação (vive dentro do `TransactionList`) —
    ramos diferentes da árvore, sem esse contexto um não teria como acionar o outro.
  - **`components/organisms/NavMenu`** é o menu aberto pelo hambúrguer — equivalente ao `NavLinks`
    dentro do `Popover` do web, não um drawer de tela inteira. Reúne o que antes estava espalhado entre
    `Header` e `Sidebar`: nome/e-mail do usuário + refresh manual (topo), wallet switcher
    ("Visualizando a carteira"), os mesmos destinos da `BottomNav`, Nova Carteira, Configurações
    (assumiu a navegação que era do ícone de engrenagem do `Header`) e Sair (assumiu o ícone de logout
    do `Header`), com a versão do app no rodapé.
    - **Nasceu como `Modal transparent` cru (fade), virou `@gorhom/bottom-sheet` depois** — pedido
      explícito de deixar mais fluido/nativo (drag-to-dismiss, spring). Precisou de
      `GestureHandlerRootView` envolvendo o app inteiro em `App.tsx` (nunca tinha sido configurado —
      `react-native-gesture-handler` só existia como dependência transitiva). Não precisou de
      `BottomSheetModalProvider` no fim — ver próximo ponto, o app usa `<BottomSheet>`, não
      `<BottomSheetModal>` (que é o único componente que precisaria desse provider).
    - **`<BottomSheetModal>` nunca funcionou neste app, em nenhuma versão/config** — `present()` nunca
      lançava erro, mas a animação de abertura nunca completava (sem `onChange`, sem conteúdo visível,
      mesmo com conteúdo trivial de teste sem nenhuma dependência). A causa raiz real, descoberta só
      depois de eliminar candidato por candidato (binário nativo desatualizado, `react-native-reanimated`
      duplicado com versões diferentes entre a raiz do monorepo e `apps/mobile/node_modules` — resolvido
      igualando as duas, ver nota de duplicação de pacotes na seção do `apps/web` mais abaixo, mesma
      categoria de bug —, bug conhecido do `@gorhom/react-native-bottom-sheet` no Portal a partir da
      `5.1.5` [issue #2316], bug conhecido do próprio Reanimated v4 no `withSpring`/`withTiming`
      [software-mansion/react-native-reanimated#7947, confirmado pelo time do Reanimated]): **o
      `<BottomSheetModal>` em si**, que só monta via Portal quando `present()` é chamado, tem algum
      problema de timing/mount nesse ambiente que nenhuma combinação de `snapPoints`/
      `enableDynamicSizing`/`animationConfigs`/versão do pacote resolveu. A solução foi trocar pro
      `<BottomSheet>` puro (sempre montado na árvore, nunca desmontado), controlado por `ref`
      (`snapToIndex`/`close`) dentro de um `useEffect` reagindo à prop `visible` — esse sim funciona.
    - Detalhes que também importam nessa troca: `animateOnMount={false}` (a primeira renderização não
      deve tentar animar — é o gatilho do travamento); `index={-1}` como valor ESTÁTICO da prop (nunca
      `index={visible ? 1 : -1}` calculado direto no JSX) porque calcular direto no render dispara um
      warning do Reanimated de "writing to value during render" e faz o sheet abrir e fechar sozinho em
      sequência; `snapPoints={['1%', '60%']}` com dois pontos (não um só) contorna o bug do
      `withSpring`/`withTiming` citado acima; `enableContentPanningGesture={false}` porque, sem isso,
      rolar o conteúdo do menu competia com o gesto de arrastar-pra-fechar do sheet e fechava ele
      sozinho (fechar por arrasto continua funcionando pela alcinha/handle no topo).
    - O seletor de carteira deixou de abrir um SEGUNDO modal (existia um átomo `Dropdown` genérico só
      pra esse uso, removido por completo) — a lista de opções expande **inline** dentro do mesmo
      sheet, sem `ScrollView` próprio (um `ScrollView` aninhado dentro do `BottomSheetScrollView`
      externo competia pelo mesmo gesto e rolava o menu inteiro em vez da lista — os itens da carteira
      só fluem no scroll do menu). Expandir/colapsar essa lista anima com `Animated` (núcleo do RN,
      mesma API do FAB da `BottomNav` acima), não Reanimated nem `LayoutAnimation` (que não tem efeito
      nenhum dentro de um `BottomSheetScrollView` — não participa do sistema clássico de layout
      animation do RN). Selecionar uma carteira só troca a carteira e fecha o menu, sem navegar pra
      Home — não é uma ação de navegação, só de contexto.
  - **FAB com a mesma animação de "redistribuição" do web**: lá, o slot central anima `flex-grow`
    (`transition-[flex-grow]`) quando `centerAction` vira `null`, encolhendo a largura do slot e não só
    a opacidade/escala do botão — os outros itens da barra se reaproximam de verdade, não é só o ícone
    que desaparece no lugar. Portado com dois `Animated.Value` em paralelo (`Animated.parallel`): um pra
    escala/opacidade do botão (`useNativeDriver: true`) e outro pra largura do slot (`useNativeDriver:
    false` — `width` não anima no driver nativo).
    - **O FAB precisa ser `position: 'absolute'` dentro do slot** (`fabAnchor`: `top: -22, left: 0,
      right: 0, alignItems: 'center'`), **não** um filho normal com `marginTop` negativo pra "subir" —
      chegamos a implementar assim (mais parecido com um hack rápido) e deu dois problemas em sequência:
      (1) com `overflow: 'hidden'` no slot pra conter a animação de largura, a parte elevada do botão
      (que "vaza" pra cima via a margem negativa) ficava cortada; (2) tirando o `overflow: 'hidden'` pra
      resolver isso, sobrava uma faixa vazia em cima da barra inteira, porque um filho em fluxo normal
      com margem negativa ainda conta (de forma estranha) pra altura automática do slot, esticando a
      altura de toda a `nav` além do necessário. `position: 'absolute'` tira o botão do fluxo por
      completo — o slot fica com altura zero (não contribui em nada pra altura da barra, que passa a
      ser ditada só pelos outros itens) e o botão flutua livre por cima, sem empurrar nada.
  - Integrado no `AuthenticatedLayout` como irmão do `ThemedView` de conteúdo (fora da área que rola),
    reservando o próprio espaço no `flex` — mesma garantia estrutural do docked do web, "impossível
    esconder conteúdo atrás dela".
- **`TransactionList`**: layout dividido em bloco fixo (seletor de mês + resumo Saldo/Entrada/Saída,
  saldo movido pra cima do resumo, igual o web) e `SectionList` com `flex: 1` logo abaixo — troca do
  hack antigo (`FlatList` com `maxHeight: '95%'`) por um flex de verdade, mesmo princípio do fix de
  scroll do web (só a lista rola, o resto fica fixo). O botão "Novo Registro" de largura total que
  existia no rodapé foi **removido** — o FAB da `BottomNav` já cobre essa ação (mesmo raciocínio do
  botão "Nova Transação" do web, escondido no mobile web por causa da bottom nav).
  - **Agrupamento por dia** ("Hoje"/"Ontem"/data) via `SectionList` (trocou o `FlatList` plano). O
    rótulo do dia usa um array próprio de nomes de mês em português (`MONTHS_LOWER`), não `date-fns`
    direto nem `DateUtils.formateTo` — esse último não aceita locale, e sem isso o mês saía em inglês
    (`"6 de July"`). Mesmo padrão hardcoded que `MonthYearSelector` já usava pros nomes de mês.
  - **Ícone de seta colorido por tipo** (`arrow-upward`/`arrow-downward`, `@expo/vector-icons`), círculo
    verde/vermelho com os tokens `feedback-success-*`/`feedback-danger-*` — antes só a cor do valor
    monetário indicava o tipo.
  - **Menu de ações (Editar/Excluir)**: botão "..." por item abre um `Modal` estilo bottom sheet com as
    duas opções, substituindo o link de texto solto "Excluir" que ficava sempre visível. A confirmação
    de exclusão continua via `Alert.alert` nativo (já era idiomático pro RN, não precisou virar dialog
    customizado como no web).
  - **Estado vazio ganhou CTA** ("Adicionar transação", abre o mesmo modal via contexto) — antes era só
    uma mensagem de texto sem nenhuma ação.
  - `ItemSeparatorComponent`/`SectionSeparatorComponent` do `SectionList` precisam ser referências
    estáveis (componentes definidos fora do corpo do componente), não arrow functions inline — senão
    o `react-hooks`/`react/no-unstable-nested-components` acusa (nova referência a cada render).
  - **Trocar de mês arrastando a lista pros lados** (vantagem mobile, sem equivalente no web) — mesma
    ação das setinhas do `MonthYearSelector`, só que via gesto. Implementado com `PanResponder` (nativo
    do React Native, sem dependência nova) em vez de `react-native-gesture-handler` — esse último já é
    dependência do projeto (via `@react-navigation`/`react-native-screens`), mas nunca foi configurado
    (precisaria de um `GestureHandlerRootView` envolvendo o app inteiro, em `App.tsx`, algo maior pra
    validar sem dispositivo em mãos). `onMoveShouldSetPanResponder` só assume o gesto quando o arrasto é
    claramente mais horizontal que vertical (`Math.abs(dx) > Math.abs(dy) * 2`), pra não competir com o
    scroll vertical da própria `SectionList` por baixo.
    - **Arrasto anima de verdade, não só troca o mês no solto do dedo**: o conteúdo da lista
      (`Animated.View` envolvendo skeleton/estado vazio/`SectionList`) segue o dedo em tempo real via
      `Animated.event` no `onPanResponderMove`, e ao soltar passando do limiar desliza pra fora na
      mesma direção do arrasto, troca o mês, reaparece do lado oposto e desliza de volta ao centro —
      efeito de "página" entrando, não uma troca seca. **Todas** as animações desse `Animated.Value`
      (arrasto, snap-back, slide de saída/entrada) usam `useNativeDriver: false`, mesmo as que
      poderiam rodar no driver nativo (snap-back/slide) — a RN não deixa misturar driver nativo e JS
      no mesmo `Animated.Value` entre chamadas diferentes, e o arrasto em si é obrigatoriamente
      JS-driven (`onPanResponderMove` precisa ler `gestureState.dx`, que só existe em JS). `overflow:
      'hidden'` no container pai evita que o conteúdo saindo/entrando vaze horizontalmente durante a
      animação.
    - **`changeMonth` precisa usar a forma funcional do `setState`** (`setMonthYearSelectorValues(prev
      => ...)`), não ler `month_year_selector_values` como variável comum. Motivo não óbvio: o
      `pan_responder` é criado uma única vez via `useRef(PanResponder.create({...})).current` — os
      callbacks (`onPanResponderMove`/`onPanResponderRelease`) ficam "congelados" com as closures do
      primeiro render pra sempre, já que `useRef` descarta os argumentos de renders seguintes. Com
      `changeMonth` lendo o state direto, todo arrasto recalculava "mês do primeiro render ± 1" (ex:
      sempre "julho ± 1"), nunca "mês atual ± 1" — sintoma: arrastar pra frente repetidas vezes ficava
      preso alternando entre só dois meses (agosto/junho a partir de julho), nunca avançava de verdade.
      A forma funcional (`prev => ...`) não depende de closure nenhuma — `setState` sempre invoca o
      updater com o estado mais recente de verdade, não importa de qual render a função foi chamada.
- **Date picker real no `TransactionFormModal`**: campo de texto com máscara manual (`DD/MM/AAAA`)
  trocado por um `Calendar` de `react-native-calendars`. Decisões relevantes:
  - **`react-native-calendars`, não `@react-native-community/datetimepicker`**: o community datetimepicker
    é um módulo nativo de verdade, não incluído no Expo Go — instalar ele exigiria dev client/build
    nativo pra qualquer teste, quebrando o fluxo de "testar via Expo Go" que o app usa no dia a dia.
    `react-native-calendars` é 100% JS (usa `xdate`, não `moment` — não reintroduz a lib que foi
    removida do projeto), funciona direto no Expo Go, sem prebuild.
  - **O calendário troca de conteúdo dentro do MESMO `Modal` do formulário** (`is_calendar_visible`
    decide se mostra os campos ou o `Calendar` + um header com botão de voltar), em vez de abrir um
    **segundo** `<Modal transparent>` por cima do primeiro. Isso foi tentado primeiro e quebrou: dois
    `Modal` nativos abertos ao mesmo tempo (RN monta cada `Modal` como uma `Window` própria no Android)
    empilhavam os dois overlays semi-transparentes (o do form + o do calendário) e, na prática, cobriam
    o app inteiro de forma muito mais escura/errada do que um simples bottom sheet por cima do form. Um
    `Modal` só, com conteúdo condicional, evita esse empilhamento por completo.
  - **Gatilho do campo de data não reaproveita o `rightComponent` do `ThemedTextInput`** — esse mecanismo
    (`position: absolute, top: '50%'`) foi desenhado pro caso sem `label` (ver uso em `sign-in`, campo de
    senha); com `label='Data da transação *'` acima, o "50%" passa a considerar a altura do label também,
    descentralizando o ícone. O gatilho da data virou um componente próprio (`dateTrigger`, texto + ícone
    lado a lado via `flexDirection: 'row'`), sem depender de posicionamento absoluto.
  - **Conversão `dd/MM/yyyy` ↔ `yyyy-MM-dd` é só manipulação de string** (`split`/template literal),
    de propósito **sem passar por `Date`/`toISOString()`** — evita qualquer risco de o fuso horário
    deslocar o dia exibido, já que aqui só interessa o valor selecionado no calendário, não um instante
    no tempo.
  - `LocaleConfig` do `react-native-calendars` (nomes de mês/dia em português) é configurado uma única
    vez, como efeito colateral de módulo em `services/calendar-locale`, importado direto no `App.tsx`
    (topo da árvore) — precisa rodar antes de qualquer `<Calendar/>` montar, não dá pra deixar dentro do
    `TransactionFormModal` (que monta/desmonta várias vezes).
- **`npm run mobile:test` estava quebrado antes desse port** (não foi introduzido por ele — o
  `jest.config.js` ainda apontava `preset: 'react-native'`, removido desde que o RN 0.86 moveu o preset
  do Jest pro pacote separado `@react-native/jest-preset`, nunca instalado). Corrigido (preset trocado +
  dependência adicionada, pinada em `0.86.0` igual `@react-native/eslint-config`/`@react-native/typescript-config`
  já eram). **Ainda existe um segundo problema, não corrigido**: `react-native-toast-message` (e
  provavelmente outras libs do ecossistema RN publicadas como ESM) quebra com
  `SyntaxError: Unexpected token 'export'`, porque o `transformIgnorePatterns` padrão do Jest ignora
  `node_modules` inteiro. Precisa de um `transformIgnorePatterns` customizado (ou migrar pro preset
  `jest-expo`, mais alinhado ao app pós-CNG) — decisão de infraestrutura de teste maior, deixada pra uma
  tarefa própria em vez de resolvida de passagem aqui.

### apps/web (Vite + React)

- A entrada `src/App.tsx` envolve o `Router` (de `src/router`) num `QueryClientProvider` do
  `@tanstack/react-query`, mesma versão pinada do mobile (`5.80.6`) — os dois apps estão alinhados
  aqui, seguido de `ThemeProvider` (`src/context/theme.tsx`) e `CurrentUserProvider`
  (`src/context/current_user.tsx`). O fluxo de auth (`sign-in`/`sign-up`/home) já consome dados via
  hook (`src/hooks/api/...`, mesmo padrão do mobile: wrapper fino em cima dos fetchers de
  `@myfinance/shared`) — não bata no axios direto em telas novas.
- `src/router/index.tsx` renderiza as rotas a partir de `src/router/routes` (`Paths: IPath[]`), onde
  cada entrada tem `{ id, path, element, template, isMainPath?, isPrivate?, isGuestOnly? }` com
  `element`/`template` como **imports estáticos normais**, não `React.lazy`. As rotas são agrupadas por
  feature em `src/router/routes/<grupo>` (atualmente `default`, `auth`, `wallets`) e concatenadas em
  `src/router/routes/index.ts`, que também lança erro no carregamento do módulo se dois `id`s de rota
  colidirem. Pra adicionar rotas novas, estenda um desses arquivos de grupo (ou crie um grupo novo e
  inclua no `Paths`).
  - **Histórico (pra não reintroduzir)**: chegou a existir `React.lazy()` por rota + um
    `router/routes/templates.ts` só pra garantir uma referência de `lazy()` única por template (cada
    chamada de `lazy()` cria uma referência de componente nova pro React, mesmo apontando pro mesmo
    arquivo — chamar `lazy()` separadamente em cada rota fazia o React desmontar/remontar o template
    inteiro a cada navegação, quebrando qualquer state local dele). Isso foi removido de vez, não só
    corrigido: sem fallback de `<Suspense>`, trocar de rota mostrava tela em branco por um instante
    enquanto baixava o chunk da página nova ("pisca" perceptível) — com o app ainda pequeno, o ganho de
    code-splitting não compensa esse custo de UX. `router/routes/templates.ts` não existe mais;
    `element`/`template` de cada rota são import direto (que já é singleton por módulo, sem truque
    nenhum, e essa é a razão de ainda funcionar sem remount mesmo sem o `lazy()`).
- **Padding lateral de página mora no template, não na página**: `components/templates/Default` tem
  `container mx-auto px-4 py-6` — isso é o que dá espaçamento pras páginas que usam esse template
  (`Home`, `Carteiras`, `Convites`), nenhuma delas precisa (nem deve) repetir isso na própria página.
  Já aconteceu de um "clean up" na `Home` remover sem querer um `<div className='p-8'>` que a página
  tinha por conta própria — como o template não fornecia padding nenhum na época, isso sumiu com o
  único respiro lateral que existia. Se alguma tela nova parecer sem espaçamento, o lugar certo pra
  conferir é o template, não a página.
- **Navegação** (`src/components/organisms/{NavLinks,Sidebar,BottomNav}`, `src/hooks/useNavItems`):
  desktop usa `Sidebar` (lista colapsável, sem tratamento especial de ação central — só
  `NavLinks` + toggle de colapsar); mobile usa `BottomNav`, **grudada na borda** (`relative`, parte do
  fluxo normal do flex do `DefaultTemplate`, não `fixed`) com até 3 destinos + botão de hambúrguer, mais
  uma ação central elevada (FAB) condicional por rota.
  - **Histórico (pra não reintroduzir)**: chegou a existir uma versão flutuante (`fixed bottom-4`, com
    margens e cantos arredondados, "ilha" separada da borda) — foi revertida porque exigia calcular um
    `padding-bottom` exato no conteúdo rolável pra não tampar a última transação da lista, e esse
    padding fica errado sempre que a altura da barra muda (ex: FAB condicional aparecendo/sumindo).
    Docked, a barra reserva o próprio espaço no flex — fica estruturalmente impossível esconder
    conteúdo atrás dela, então não existe padding nenhum pra manter sincronizado.
  `NavLinks` é o conteúdo compartilhado entre o `Sidebar` e o popover do hambúrguer do mobile
  (evita duplicar a lista em dois lugares) — inclui os destinos fixos, "Nova Carteira" (ação sempre
  disponível, não amarrada a rota) e o toggle de tema/logout.
  - `useNavItems` centraliza a lógica de "o que mostrar" separada da renderização — é a peça pensada
    pra ficar fácil de portar pro mobile depois (lá a leitura da rota atual troca de `useLocation()`
    do react-router-dom pra algo como `useRoute()` do React Navigation, mas a FORMA — destinos fixos +
    uma ação central sensível a rota — deveria ficar igual). `centerAction` só existe (`!== null`) na
    Início (`/`), que é sempre a visão da carteira selecionada no contexto (`useWallet()`, ainda não
    implementado no web — ver nota de "próximos passos" abaixo); em qualquer outra rota o valor é
    `null` e quem renderiza decide não mostrar nada elevado no lugar (não um espaço vazio reservado).
  - O botão central da `BottomNav` fica **sempre montado** — anima `scale`/`opacity` (0↔100%) e o slot
    ao redor anima `flex-grow` em vez de aparecer/sumir via `{condição && <div>}`, porque isso não dá
    pra animar (não existe "de" um estado desmontado). Guarda a última ação conhecida num state local
    só pra o ícone não sumir instantaneamente no meio da transição de saída.
  - **Não tem animação de entrada na `BottomNav` em si** (barra inteira aparecendo/deslizando) — chegou
    a ser tentado com `tailwindcss-animate` (`animate-in slide-in-from-bottom-4`) na época em que a
    barra ainda era flutuante e usava `-translate-x-1/2` (transform) pra se centralizar horizontalmente;
    quebrou porque o `animate-in` também controla `transform` durante toda a animação (seta
    `translate3d(...) scale3d(...) rotate(...)` combinado, mesmo só usando `fade-in` sem slide/zoom
    explícito), e os dois brigavam pelo mesmo `transform`. Esse conflito específico não existe mais
    (a barra é docked, sem transform próprio nenhum), mas a lição geral fica: não misture
    `animate-in`/`slide-in-from-*` do `tailwindcss-animate` com um `transform` estático no mesmo
    elemento — separe centralização/posicionamento (wrapper externo, sem animação) do elemento que
    anima (interno).
  - Ícones do hambúrguer usam `Popover` (`src/components/ui/popover.tsx`), não `Sheet`
    (`src/components/ui/sheet.tsx`, criado primeiro mas trocado — o pedido era um menu "flutuante,
    quase como uma tooltip saindo do botão", não um painel full-width vindo de baixo). O `Sheet` ficou
    no repo como primitivo genérico pra outro uso futuro (ex: um filtro em tela cheia no mobile), não
    está morto, só não é usado ainda.
  - **`NavLink` sem a prop `end` casa por prefixo**: `/wallets` "contém" `/wallets/invites`, e pior,
    `/` é prefixo de **qualquer** rota — sem `end`, o item "Início" ficaria sempre ativo em toda tela.
    Todo `NavLink` renderizado a partir de `navItems` usa `end` (ver `NavLinks`/`BottomNav`) porque
    nenhuma dessas rotas hoje tem sub-rota que precisaria do match por prefixo; se isso mudar no
    futuro (uma rota pai com sub-rotas reais), reavaliar caso a caso, não remover `end` de todo mundo.
  - **Conteúdo de `Popover`/`Sheet` (Radix) é renderizado num `Portal` direto no `<body>`**, fora da
    árvore DOM de quem abriu — esconder o gatilho via CSS (`hidden md:flex`/`md:hidden`) não fecha um
    popover/sheet que já estava aberto ao cruzar o breakpoint, ele fica "órfão" flutuando na tela
    (não tem `md:hidden` nenhuma alcançando o conteúdo portado). Por isso `Sidebar`/`BottomNav` são
    **desmontados de verdade** via `useMediaQuery('(min-width: 768px)')` (`src/hooks/useMediaQuery`)
    em `DefaultTemplate`, não só escondidos via classe — desmontar o componente inteiro é a forma
    confiável de garantir que nada portado sobrevive escondido.
  - **Escopo de carteira** (`context/wallet.tsx`, `WalletUserProvider`/`useWallet()`) — equivalente ao
    `context/wallet.tsx` do mobile, mesmo padrão: busca a carteira principal
    (`hooks/api/wallets/useGetMainWallet`) assim que existe token + usuário carregado, guarda em
    `user_wallet`. `organisms/WalletSwitcher` (`Select` do shadcn, `ui/select.tsx`) é o equivalente do
    `Dropdown` "Visualizando a carteira:" do `Sidebar` do mobile — fica dentro do `NavLinks`
    (aparece no Sidebar e no popover do hambúrguer de graça), alimentado por
    `hooks/api/wallets/useIndexWallets`, escrevendo em `setUserWallet` ao trocar. Só renderiza quando
    `showLabels` é `true` (escondido com o Sidebar colapsado — um `Select` não tem um modo
    "só ícone" que faça sentido). `centerAction`/`newWalletAction` continuam placeholder
    (`toast.info('Em breve')`) — o contexto da carteira existe agora, mas criar carteira/transação de
    verdade ainda é o próximo fluxo, não esse.
  - **Transações na Home** (`organisms/TransactionList`, `TransactionFormDialog`) — lista as transações
    da carteira selecionada (`useWallet()`), com seletor de mês (setas + rótulo, sem modal como o
    mobile tinha), uma barra leve de Saldo/Entrada/Saída (nada de card grande com número gigante — isso
    já foi tentado e destoava do resto, ficou "bruto" — o mobile faz isso como texto simples lado a
    lado, sem caixa, e é essa referência que vale seguir), lista agrupada por dia ("Hoje"/"Ontem"/data),
    ícone de seta por tipo (`deposit`/`withdraw`), menu de ações (`DropdownMenu`) por transação e
    confirmação de exclusão via `AlertDialog`. Formulário de nova/editar transação usa `Calendar`
    (`react-day-picker` — único caso no repo, `date-fns` já era dependência do `packages/shared`,
    mesma versão `^3.6.0`, sem conflito) dentro de um `Popover` em vez de campo de data digitado à mão
    como o mobile.
  - **Seletor de mês + barra de Saldo/Entrada/Saída são `sticky top-0 z-10`** dentro do container
    rolável da `TransactionList`, com fundo opaco (`bg-background-light dark:bg-background-default`,
    igual o fundo da página) pra não deixar a lista "passando por baixo" transparente. Sem isso o
    usuário perdia de vista o mês/saldo ao rolar a lista pra baixo — precisava voltar ao topo pra
    conferir de novo.
  - **Botão "Nova Transação" só aparece no header em telas `md:` pra cima** — no mobile o "+" da
    `BottomNav` já cobre essa ação (via `context/newTransactionDialog.tsx`, que sincroniza os dois
    porque vivem em ramos diferentes da árvore — a `BottomNav` mora no `DefaultTemplate`, o diálogo
    mora dentro da `Home`); duplicar o botão ali seria redundante.
  - `queryClient` saiu do `App.tsx` pra `services/query-client/index.ts` (mesma localização do
    mobile) — os hooks de mutação de transação (`useCreateTransactions`, etc.) precisam importar ele
    pra invalidar cache depois de criar/editar/excluir, e importar de volta do `App.tsx` seria estranho.
  - **Desktop usa tabela, mobile usa cards** — `TransactionList` renderiza os dois layouts (um
    `hidden md:block`, o outro `md:hidden`) reaproveitando a mesma lógica de ícone por tipo e menu de
    ações via funções auxiliares (`renderKindIcon`/`renderActionsMenu`), só a marcação (`<table>` vs
    `<div>`) muda. A tabela (`ui/table.tsx`, HTML semântico puro, sem lib nova) tem ordenação por
    coluna local (sem paginação/API, ordena o array já carregado do mês) — `react-data-table-component`
    segue instalado mas sem uso (motor de estilo próprio, não usa os tokens daqui).
  - **`asChild` do Radix precisa de `forwardRef` na cadeia inteira até o `<button>` real** — o átomo
    `Button` (`atoms/Button`) envolve o `ui/button` só repassando `isLoading`, mas sem `forwardRef`;
    usado com `asChild` dentro de `DropdownMenuTrigger`/`PopoverTrigger` (que dependem de anexar ref no
    filho pra funcionar), a ref se perdia no meio do caminho e o clique simplesmente não abria nada —
    sem erro nenhum no console, silencioso. Qualquer átomo novo que possa ser usado como filho de
    `asChild` (Radix `Slot`) precisa encaminhar a ref, não só as props.
  - **`Dialog`/`AlertDialog` (shadcn) usam `w-full` + `sm:rounded-lg`** por padrão — no mobile isso
    cola o modal nas bordas da tela inteira, sem nenhum arredondamento (só ganha isso a partir do
    desktop). Ajustado pra `w-[calc(100%-2rem)]` + `rounded-lg` sempre, dando a mesma margem/cantos em
    qualquer tamanho de tela — se usar esses primitivos em outro lugar, não reverta isso sem querer.
  - **`useCurrentUserContext()`/`useWallet()` expõem `is_loading`** — nenhum dos dois expunha isso
    originalmente, só `data`; quem consumia não tinha como distinguir "ainda carregando" de "carregou
    e não tem nada", e a `TransactionList` chegou a disparar `useListTransactions` com `wallet_id: ''`
    antes da carteira carregar (sem `enabled`), batendo na API errado antes de corrigir sozinho. O
    `is_loading` da carteira usa `isFetched` da query (não só "ainda não tem dado"), pra não virar
    loading infinito quando o usuário legitimamente não tem carteira nenhuma. Qualquer tela nova que
    dependa de `current_user`/`user_wallet` deve conferir esse `is_loading` antes de assumir "vazio",
    e qualquer `useQuery` cujo parâmetro dependa de outro dado assíncrono (ex: `wallet_id`) precisa do
    `enabled` amarrado a esse dado, não só um fallback tipo `|| ''`.
- `src/components` segue o padrão atoms/molecules/organisms/templates (organisms só apareceram com a
  navegação acima — antes disso era atoms/molecules/templates, sem organisms, diferente do mobile).
- Alias de path `@` → `src` (configurado em `vite.config.ts` `resolve.alias` e consumido via
  `vite-tsconfig-paths`). Imports absolutos `@/...` são obrigatórios por lint
  (`no-relative-import-paths/no-relative-import-paths`, `allowSameFolder: true`) — diferente do mobile,
  aqui um import relativo (`../../foo`) fora da mesma pasta falha no lint.
- Estilização é Tailwind CSS + shadcn/ui (`@material-tailwind/react` foi removido — instalado mas
  nunca usado em nenhum componente, e o preset dele conflitava com o do shadcn); os design tokens
  "de app" (spacing, fontSize, etc.) ficam em `src/util` (`Tokens`, referenciado por
  `src/types/index.ts` pra `TFontSize`/`TColor`/etc.). i18n via `i18next`/`react-i18next`.
- **shadcn/ui**: `components.json` configura o CLI (`npx shadcn add <componente>` funciona direto,
  sem precisar reconfigurar nada), `src/lib/utils.ts` tem o `cn()` (clsx + tailwind-merge). Os
  primitivos ficam em `src/components/ui/*` (`button`, `input`, `label`, `checkbox`, `sonner`) — **eles
  nunca são importados diretamente por página/feature**, só pelos átomos em
  `src/components/atoms/*` (`Button`, `TextInput`), que são wrappers finos por cima. Ícones são
  `lucide-react` (usado direto por páginas/componentes, não precisa de wrapper — já é a lib que o
  shadcn usa internamente nos próprios componentes, então dá pra misturar sem gerar inconsistência
  visual). Toast é `sonner` (trocou `react-toastify`), sempre através do hook `src/hooks/useToast`
  (nunca `import { toast } from 'sonner'` direto numa página).
- **Tema (light/dark)**: `src/context/theme.tsx` (`ThemeProvider`/`useTheme()`) é a única fonte de
  verdade — antes existia um hook `useTheme` ad-hoc que criava um `useState` local por componente,
  sincronizado só via `localStorage` lido no mount; qualquer toggle ficava "preso" ao componente que
  clicou, sem refletir em outros lugares até um reload. Se precisar ler/trocar o tema em código novo,
  sempre consuma o contexto, nunca reimplemente um state local pra isso.
  - As variáveis CSS do shadcn (`--background`, `--primary`, `--secondary`, etc., em
    `src/styles/index.css`, dentro de `:root`/`.dark`) são a paleta de marca de
    `packages/shared/src/tokens.ts` **convertida pra HSL** (não é uma paleta nova) — se adicionar um
    token de marca novo lá, recalcule o HSL e adicione aqui também, os dois lados não sincronizam
    sozinhos.
  - **`body` precisa de `@apply text-foreground`** no `index.css` (`@layer base`). Sem isso, qualquer
    texto sem cor explícita (ex: `Label` do shadcn, que não define cor própria de propósito) herda o
    preto padrão do browser em vez de acompanhar o tema — foi exatamente isso que quebrou as labels
    dos inputs e do "manter conectado" na primeira versão do dark mode aqui.
  - Ao adicionar uma paleta de cor nova (ex: `--secondary` de um tema), confira que ela não fique
    visualmente parecida com `--primary`/`--accent` — já erramos isso uma vez usando `brand-tertiary`
    (outro tom de verde) como `--secondary` do dark mode, fazendo os botões "Entrar" (primary) e
    "Cadastre-se" (secondary) ficarem quase idênticos.
  - **Telas de auth também precisam do toggle de tema** (`components/templates/Auth` tem o botão) —
    existia um `useEffect` ali que forçava tema claro escondido sempre que a página montava; foi
    removido, mas se voltar a implementar um template novo, não reintroduza esse tipo de forçamento.
- **shadcn/sonner e classes Tailwind não se misturam bem pra cor**: o `sonner` aplica
  background/borda/texto via `[data-sonner-toast][data-styled='true']` (dois seletores de atributo,
  especificidade maior que qualquer classe Tailwind isolada) — `toastOptions.classNames` pra cor
  **nunca vence** essa guerra de especificidade, não adianta tentar de novo com hex direto ou
  `!important` na classe. As cores por tipo (`success`/`error`/etc.) também só existem sob
  `[data-rich-colors='true']`, que precisa da prop `richColors` no `<Toaster>`. O jeito certo (já
  implementado em `src/components/ui/sonner.tsx`) é sobrescrever as **variáveis CSS** que o próprio
  sonner lê (`--normal-bg`, `--success-bg`, etc.) via `style` inline no `<Toaster>`, apontando pros
  tokens `--toast-*` de `index.css`.
- **React duplicado no monorepo afeta qualquer pacote hoisted na raiz, não só `react-router`**: o
  problema documentado acima, na seção do mobile, pro `react-router-dom` (dedupe do npm pro React 19
  do mobile em vez do React 18 do web) se repete pra **qualquer** pacote hoisted que dependa de React
  como peer —
  já apareceu de novo com `lucide-react` e os pacotes `@radix-ui/*` (usados pelos primitivos do
  shadcn), sempre com o mesmo sintoma: erro de tipo tipo "X cannot be used as a JSX component" no
  editor/`tsc`, mesmo com `npm run webapp:build` passando limpo. A causa: o editor e um `tsc` direto
  usam `tsconfig.json`, que tem um redirect de tipos (`paths`: `react`/`react-dom` →
  `../node_modules/@types/react`/`@types/react-dom`, a cópia local do `apps/web`) — mas esse mesmo
  redirect quebraria o Vite em runtime se ele enxergasse (`@types/react` não é um pacote executável).
  Por isso existe um `tsconfig.vite.json` separado (mesmo arquivo, sem esse redirect) e
  `vite.config.ts` aponta `vite-tsconfig-paths({ projects: ['tsconfig.vite.json'] })` pra ele —
  **não delete `tsconfig.vite.json` nem mova o redirect de volta pro `tsconfig.json` compartilhado sem
  entender esse split**. `vite.config.ts` também tem `resolve.dedupe: ['react', 'react-dom']`, que
  cobre a duplicação em runtime (bundle), separado do problema de tipos.
- **Zumbi do Vite no Windows pode travar o cache** (`apps/web/node_modules/.vite`): `npm run
  webapp:dev` roda via `cmd.exe /d /s /c vite --host` — um `Ctrl+C` no terminal nem sempre mata o
  processo `esbuild` que o Vite mantém rodando em segundo plano (encadeamento
  cmd.exe→node→esbuild.exe), sobretudo se você reinicia rápido no mesmo terminal. O zumbi segura um
  lock de arquivo em `node_modules/.vite/deps` (nome fixo, não muda por tentativa), e qualquer
  instância nova do Vite falha ao tentar renomear sua própria pasta temporária pra esse nome —
  sintoma: erro tipo `Uncaught SyntaxError: ... does not provide an export named 'X'` depois de uma
  mudança que não tem nada a ver com isso, e/ou pastas `deps_temp_*` órfãs (sem nenhuma `deps` final)
  dentro de `node_modules/.vite`. Diagnóstico: `netstat -ano | findstr :5173` (ou a porta em uso) pra
  achar o PID, `taskkill /PID <pid> /F /T` (o `/T` mata a árvore inteira, não só o processo pai), aí
  sim limpar `node_modules/.vite` e subir de novo.
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

- **NUNCA subir o servidor de desenvolvimento** (`npm run webapp:dev`, `npm run mobile:start`, `expo
  start`, `vite dev`/`vite preview`, ou qualquer processo que sirva/rode o app). O dono do repo testa
  **sempre na mão** — deixe a execução do app pra ele. Pode rodar typecheck, lint, testes e build
  (validação estática), só não iniciar servidor nem abrir o app.
- READMEs e este `CLAUDE.md` são escritos inteiramente em português.
- Mensagens de commit são escritas em português.
- Todo fluxo novo do `apps/web` precisa funcionar em desktop **e** responsivo (mobile web) — teste os
  dois antes de considerar uma tela pronta, não só o layout desktop.
