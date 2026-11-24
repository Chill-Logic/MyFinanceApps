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
- `utils/` — `DateUtils`, `MoneyUtils`, `TextUtils`, `TransactionUtils`, `InvoiceUtils`: formatação/lógica
  pura, sem dependência de plataforma. `TransactionUtils.effectiveDate(t)` = `settled_at ||
  transaction_date` (espelha o `COALESCE` do backend) — usado pra agrupar transações por dia nos dois
  apps, pra a efetivada cair no dia em que foi paga, não no vencimento nominal. `InvoiceUtils.label(inv)`
  = nome da fatura pelo `due_date` ("Agosto 2026" = a que VENCE em agosto, não a do ciclo de compras);
  `InvoiceUtils.isCurrent(inv, today?)` = hoje ∈ `[cycle_start, cycle_end]` fechado (fatura atual de
  verdade, não "offset 0 de navegação"). Nomes de mês em pt-BR hardcoded no helper porque
  `DateUtils.formateTo` não aceita locale (sairia em inglês); comparação de datas por string `YYYY-MM-DD`
  pra não deslocar por fuso.
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
- **`TransactionList`**: layout dividido em bloco fixo (seletor de mês + card "Total do mês") e
  `SectionList` com `flex: 1` logo abaixo — troca do hack antigo (`FlatList` com `maxHeight: '95%'`) por
  um flex de verdade, mesmo princípio do fix de scroll do web (só a lista rola, o resto fica fixo). O
  botão "Novo Registro" de largura total que existia no rodapé foi **removido** — o FAB da `BottomNav`
  já cobre essa ação (mesmo raciocínio do botão "Nova Transação" do web, escondido no mobile web por
  causa da bottom nav).
  - **Cabeçalho compacto pra caber mais itens na lista (2026-08-02):** o resumo era um card alto com 4
    informações empilhadas (Saldo efetivado / Previsto / Entrada / Saída) e o `MonthYearSelector` tinha
    o mês centralizado + o ano numa segunda linha + setas circulares grandes (`padding: 10`, `size 24`).
    Junto, isso comia a altura da área rolável e o mobile mostrava bem menos transações que o web na
    mesma tela. Espelhamos a densidade do web: o card virou **uma linha** ("Total do mês" + saldo
    efetivado + "previsto X · N pendentes" inline) com um botão **"i"** (`info-outline`) que abre o
    detalhe completo (efetivado/previsto/entradas/saídas) num `Modal` bottom-sheet — mesma decisão do web
    mobile, que esconde entrada/saída atrás de um `Popover` "i" pra sobrar tela pra lista. O
    `MonthYearSelector` virou uma **faixa de linha única** ("Julho 2026" via `MONTHS_TITLE` title-case,
    igual o web, em vez de "JULHO" empilhado com o ano) e setas menores (`padding: 7`, `size 20`). O
    modal de seleção de período (tocar no rótulo) continua igual. Combinado, corta ~90px do cabeçalho
    (≈1,5 item a mais visível).
  - **Pegadinha do `lineHeight` herdado do `ThemedText` (afeta a densidade da lista):** o `ThemedText`
    default aplica `fontSize: 16, lineHeight: 24`; um `style` que sobrescreve **só** `fontSize` (ex:
    descrição 14, chip de origem 11, selo Pendente/Rascunho 10) **não** sobrescreve o `lineHeight`, então
    o texto pequeno segue ocupando 24px de altura de linha — inflando a altura de cada card sem motivo
    aparente (o web, com `text-sm`/`text-[11px]`, não arrasta isso). Sintoma comparando lado-a-lado com o
    web: mesma transação mostra menos caracteres antes do `…` e o chip "Nubank Jhonathan" fica visivelmente
    maior/mais alto no mobile. Fix: **sempre setar `lineHeight` junto do `fontSize`** em texto pequeno da
    lista (descrição `18`, chip/selo `14`). Sem isso, apertar padding/gap não resolve — o arrasto está na
    caixa de linha do texto, não no espaçamento.
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

**Port do domínio contas/cartões/crédito pro mobile (Etapa 3, 2026-08-02):** o backend passou a fazer
toda transação nascer de uma **origem** (`source_type` = `Account`/`CreditBalance` + `source_id`; a
`wallet_id` é derivada pelo backend), com `settled_at` (efetivada vs pendente), `draft` e
`credit_card_id`. Isso nasceu no `apps/web` e foi portado pro mobile espelhando os padrões já existentes.
Toda a camada de rede (fetchers, tipos, `QUERY_KEYS`) já morava em `@myfinance/shared` — o port foi só
hooks mobile + UI nativa. Decisões de UX nativa que **divergem do web** de propósito (prováveis de
reaparecer se alguém comparar os dois apps):
- **16 hooks novos** em `hooks/api/{accounts,credit-balances,credit-cards}` + `useSettleTransaction`/
  `useUnsettleTransaction`, seguindo o padrão dos hooks de `wallets`/`transactions` (export nomeado,
  `getAxiosInstance`, `queryClient` de `services/query-client`, invalidação por `QUERY_KEYS`). Tipos de
  params dos fetchers (`TIndexAccountsParams` etc.) vêm de `@myfinance/shared` (moram no fetcher, não em
  `api.ts`), os de body/model do re-export `types/api`/`types/models`.
- **Tela `screens/finances`** (abas Contas/Cartões, estado local). A ordem de `NAV_ITEMS` (`useNavItems`)
  espelha o web: `home → finances → my_wallets → wallets_invites`. A `BottomNav` desestrutura os **3
  primeiros** posicionalmente (`[home_item, finances_item, wallets_item]`) → barra = Início/Contas/Carteiras,
  igual o web; **Convites (4º) fica só no `NavMenu`** (que faz `navItems.map` e mostra todos), onde também
  vive o badge de convites. Se reordenar `NAV_ITEMS`, lembre que a barra sempre reflete os 3 primeiros.
  `TNavItem.short` dá um rótulo curto pra barra ("Contas" em vez de "Contas & Cartões"); o `NavMenu` usa o
  `label` completo. Ajuste feito na conciliação de paridade de 2026-08-02 (o print lado-a-lado mostrou a
  barra do mobile divergindo do web — antes era Início/Carteiras/Convites).
- **Sem telas separadas de gestão**: contas/créditos/cartões são CRUD via **modais** (mesmo esqueleto de
  `WalletFormModal`) e action-sheets (`Modal` + `Alert.alert`, padrão de `my-wallets`), não `Dialog`/
  `DropdownMenu`/`AlertDialog` como o web. `AccountFormModal`, `CreditBalanceFormModal`,
  `CreditCardFormModal`, `PayInvoiceModal`, e `CreditBalanceList` (com o card de crédito: barra de uso +
  bloco de fatura com navegação de ciclo por `cycle_offset`/`useGetInvoice` + lista de cartões).
- **Criação unificada "Novo cartão"** (`NewCardModal` no mobile / `NewCardDialog` no web, 2026-08-02) —
  a pedido do dono, pra tirar do usuário a distinção "linha de crédito" vs "cartão". Um único modal
  (o antigo "Novo crédito" virou "Novo cartão"; o botão "Adicionar cartão" por linha foi **removido**):
  campos Nome\*, Últimos dígitos, um checkbox **"Compartilhar limite"** (+ um "i" com tooltip; no web é
  `Popover`, no mobile um texto inline que aparece ao tocar o `info-outline`) e, condicionalmente,
  Limite\*/Fechamento\*/Vencimento\* (sem compartilhar) OU um select das linhas existentes (compartilhando).
  Salvar **sem compartilhar**: cria a `CreditBalance` (nome = o do usuário) e, no `onSuccess`, um
  `CreditCard` chamado **`"PRINCIPAL"`** dentro dela. **Compartilhando**: cria só o `CreditCard` (nome do
  usuário) na linha selecionada. `CreditBalanceFormModal`/`CreditCardFormModal` (mobile) e os `*FormDialog`
  (web) seguem existindo, mas **só pra edição** agora.
- **`TransactionFormModal` reformulado**: seletor de **origem** num `SelectInput` (Picker) único e
  achatado com `value` codificado `"Account:<id>"`/`"CreditBalance:<id>"` e label **prefixado**
  ("Conta · " / "Crédito · ") — o Picker nativo não agrupa como o `Select` do shadcn no web. Cartão em
  segundo `SelectInput` condicional (só crédito), auto-seleciona se houver 1 só. **Pendente/Rascunho**
  são linhas de toggle com ícone `check-box`/`check-box-outline-blank` (MaterialIcons), não `Checkbox`.
  Empty-state (sem conta nem crédito) navega pra `Finances` via `useNavigation()`. Campos ficam num
  `ScrollView` dentro do modal (`maxHeight: '88%'`) porque agora são muitos. Submit cria→efetiva
  (encadeia `useSettleTransaction` no `onSuccess`) quando não é pendente/rascunho — o backend cria sempre
  pendente. **Gotcha de lint**: `useNavigation<{ navigate: (route: string) => void }>()` fazia o
  `func-call-spacing` disparar no espaço antes do `(` da anotação de tipo — usar sintaxe de método no
  tipo (`{ navigate(route: string): void }`) contorna.
- **`TransactionList`**: params de listagem usam `reference` (`YYYY-MM`), não mais `start_date`/`end_date`.
- **Conciliação de paridade da Home (2026-08-02, logo após o port):** trazido pro mesmo nível do web —
  **efetivar/desfazer por linha** (settle/unsettle no action-sheet, só quando não é rascunho),
  **totais efetivado vs previsto + contagem de pendentes** (helper `buildSummary` espelhando o web:
  efetivado = não-rascunho E settled; previsto = todos não-rascunho; rascunho fora dos dois), **abas por
  tipo de origem** (Contas/Cartões, filtro no cliente — o total do mês continua sendo de TODAS as origens,
  igual o web no mobile; as abas são um **`SegmentedControl` reutilizável** — `atoms/SegmentedControl` no
  mobile, `molecules/SegmentedControl` no web — com "thumb" que **desliza** entre os segmentos: no mobile é
  um `Animated.View` absoluto animado por `translateX` (driver nativo, largura medida via `onLayout`), no
  web um `<div>` absoluto com `transition-transform`; usado também na tela `Finances`/`/accounts`. Substituiu
  os dois botões bordados altos que existiam antes, a pedido), e **chip de origem por linha** (nome da conta/crédito via um `source_names` Map,
  colorido por tipo) + selos Pendente/Rascunho, e **sinal `+`/`-` no valor** por linha (igual o web — o
  `MoneyUtils.formatMoney` sempre devolve o valor positivo/sem sinal, então o `+`/`-` é prefixado à mão a
  partir do `kind`; a cor sozinha não bastava pra bater com o web). Empty-state em dois casos (sem origem do
  tipo → navega pra `Finances`; com origem mas sem transação → adicionar). O `user_name` na linha saiu (o web não mostra;
  o chip de origem tomou o lugar). Mantido o **arrastar-pra-trocar-mês** (vantagem mobile, sem equivalente
  no web). Ignorados de propósito os recursos **exclusivos de desktop** do web (tabela ordenável por
  coluna, subtotal por aba inline) — não fazem sentido no app.
- **`my-wallets`: definir carteira principal** (também 2026-08-02) — ação "Definir como principal"
  (`PATCH /users/me` com `main_wallet_id` via `useUpdateCurrentUser`, invalida `wallet.get_main` pro badge
  atualizar) + badge "Principal" (estrela) na carteira cujo id bate com `useGetMainWallet`. O "⋮" agora
  aparece pra qualquer carteira que não seja a principal (não só pro dono), já que definir principal vale
  pra qualquer carteira acessível; editar/convidar/excluir seguem owner-only dentro do sheet. Espelha o
  `WalletList` do web.
- Validado só com `mobile:typecheck` + `mobile:lint` (ambos limpos) — não rodado em runtime (o dono
  testa na mão, e `mobile:test` tem o problema de ESM/`transformIgnorePatterns` descrito acima).

**Adaptação ao backend novo — index de transações separado + fatura parcial (2026-08-02):** o backend
(`my-finance-api`, repo separado read-only) mudou o contrato em dois pontos, adaptados nos dois apps +
`packages/shared`:
- **`GET /transactions` passou a vir SEPARADO** em `{ accounts, credits }` (cada um um `TTransactionGroup`
  = `{ data, total_count, total_settled, total_projected }`), em vez do `{ data, total_count, ... }` plano
  de antes. Motivo do backend: evitar dupla contagem do cartão (pagamento da fatura conta só em `accounts`,
  compras só em `credits`) e fazer a aba Cartões respeitar o **ciclo de fatura** de cada crédito. As duas
  visões usam **janelas diferentes**: `accounts` = mês-calendário seguindo `settled_at` (ou
  `transaction_date` enquanto pendente); `credits` = ciclo de fechamento de cada `CreditBalance` por
  `transaction_date` (desde 2026-09-06 o bucket é o `invoice_month` da transação — ver seção abaixo).
  Impacto no front: os dois `TransactionList` (web e mobile) **paravam de listar**
  (liam `.data` de um objeto que não tem mais esse campo → lista vazia). Correção: `TListTransactionsResponse`
  virou `{ accounts, credits }` + `TTransactionGroup`; a aba (`SegmentedControl`) agora **escolhe o grupo**
  (`source_type === 'Account' ? accounts.data : credits.data`) em vez de filtrar `source_type` no cliente
  (o filtro do cliente não respeitava o ciclo do cartão). **Desatualizado (corrigido em 2026-11-23):** na
  época o "Total do mês · todas as origens" somava `accounts` + `credits`; desde o redesign o card de destaque
  da Início (web) usa **só `accounts`** — `buildSummary(data_all?.accounts, ...)` no `TransactionList`:
  saldo efetivado (`total_settled`), "Fim do mês" (`total_projected`), pendentes e Entrou/Saiu, como fluxo de
  caixa real. Cartão nenhum entra nesses totais. A única informação de cartão no card é o chip "faturas em
  aberto" (soma do `remaining` das faturas do mês exibido, a mesma do card "Faturas do mês"), que não entra
  em total nenhum. Os params `source_type`/`source_id` de
  `TListTransactionsParams` continuam existindo (o backend ainda os aceita), mas os apps **não passam mais**.
  - **Agrupamento por dia usa a DATA EFETIVA, não `transaction_date`:** como o backend agora bucketiza
    `accounts` por `COALESCE(settled_at, transaction_date)`, agrupar a lista no cliente por
    `transaction_date` cru colocaria uma transação efetivada num dia diferente do vencimento no grupo
    errado (podendo até cair fora do mês devolvido). O `groupTransactionsByDay` dos dois apps agora
    agrupa por `TransactionUtils.effectiveDate(t)` (`settled_at || transaction_date`, helper em
    `packages/shared/src/utils/transaction.ts`). A tabela desktop do web (view tabular, coluna "Data"
    ordenável) **segue exibindo/ordenando por `transaction_date` nominal de propósito** — não é
    agrupamento por dia.
- **Fatura com pagamento parcial**: `TCurrentInvoice` ganhou `paid_amount` e `remaining` (`paid` agora só
  é `true` com a fatura 100% quitada); `TPayInvoiceBody` ganhou `value` (parcial; ausente = paga o
  `remaining`) e `reference` (`YYYY-MM`, seleciona o ciclo); `TGetInvoiceParams` ganhou `reference`. UI
  (web `PayInvoiceDialog` / mobile `PayInvoiceModal`): campo de valor pré-preenchido com o `remaining`,
  editável (permite parcial), + bloco "Já pago / Restante" quando `paid_amount > 0`. Nas listas de crédito
  (`CreditBalanceList` dos dois): `can_pay` agora é `remaining > 0` (não mais `!paid && amount > 0`), status
  mostra "restante R$ X" quando parcial, e o botão vira "Pagar restante". Navegação de ciclo mantida por
  `date` (o backend resolve o ciclo pela data); a mesma fatura pode ser paga várias vezes (soma em
  `paid_amount`, inclusive acima do total).
  - **"Fatura atual" e o nome da fatura vêm da PRÓPRIA fatura, não do offset de navegação:** o rótulo
    ("Agosto 2026") é `InvoiceUtils.label(invoice)` (mês/ano do `due_date` — a fatura "de agosto" é a que
    VENCE em agosto), e a tag "Fatura atual" é `InvoiceUtils.isCurrent(invoice)` (hoje ∈
    `[cycle_start, cycle_end]` fechado), não mais `cycle_offset === 0`. O offset 0 segue decidindo só a
    FONTE do dado (usa a `current_invoice` embutida no index, sem request) — mas o texto/tag lê a fatura
    de verdade. Enquanto uma fatura navegada carrega, o rótulo cai num fallback pela data de vencimento
    derivada do offset (`InvoiceUtils.label({ due_date: dueForOffset(...) })`) até o `due_date` real chegar
    (os dois coincidem, sem flicker).
  - **Navegação de fatura é por `date` (`cycle_range`), NÃO por `reference` (`cycle_for_month`):** dois
    bugs em sequência aqui, o segundo revelado pelos dados reais da API. (1º) Navegar por `date = hoje +
    offset meses` pulava faturas, porque a `current_invoice` embutida fica um ciclo atrás de
    `cycle_range(hoje)` quando hoje já passou do fechamento. (2º) Troquei pra `reference` (YYYY-MM)
    ancorado no `due_date`, assumindo `reference` M → vence M+1 (comportamento do checkout LOCAL do
    backend). Mas o backend **deployado** mapeia `reference` M → vence **M** (o commit local está à frente
    do deploy) — então mandava um mês a menos (offset +1 pedia a fatura de Agosto de novo; offset −1
    pulava Julho). **A convenção de `reference`/`cycle_for_month` divergiu entre deploy e local**, então
    paramos de depender dela: navegamos por `date` (dia 1 do mês do `cycle_end` da fatura atual + offset),
    que cai em `cycle_range` no backend — o MESMO cálculo da `current_invoice` embutida, estável entre
    versões. Helper `dateForOffset(cycle_end, offset)` → `YYYY-MM-01`; dia 1 é sempre válido (sem rollover)
    e sempre dentro do ciclo que fecha naquele mês. O `date` é calculado SEMPRE (inclusive offset 0) e
    passado pro `PayInvoiceDialog`/`PayInvoiceModal` — sem ele o backend pagaria o ciclo de HOJE, que pode
    não ser a fatura exibida (bug latente de pagamento no ciclo errado, também corrigido). `useGetInvoice`
    ganhou `placeholderData: keepPreviousData` (mantém a fatura anterior na tela durante a troca, sem
    piscar loader) e a query key inclui `reference` e `date`. **RESOLVIDO em 2026-09-06** — o backend
    passou a expor `invoice_month` e a definir `reference` sem ambiguidade, e a navegação voltou pra
    `reference`; ver a seção do `invoice_month` abaixo. Os helpers `dateForOffset`/`dueLabelForOffset`
    não existem mais.
- **Token não expira mais** (`jwt_encode` com `exp = nil`): não muda nada no front — o auto-login do mobile
  já valida via `/users/me` ([[feedback_never_trust_persisted_token]]); só sumiu a causa da cascata de 401
  por expiração de 7 dias.

**Adaptação ao backend novo — `invoice_month` e melhor dia de compra (2026-09-06):** o backend trocou a
forma de decidir de que fatura é uma transação de crédito. Duas mudanças, uma delas *breaking*:
- **`closing_day` virou `best_purchase_day`** (breaking — o param antigo não é mais aceito). Não existe
  mais "dia de fechamento" no domínio: bancos divergem sobre cobrar ou não no próprio dia, então o campo
  passou a ser o **melhor dia de compra**, o dia em que o ciclo VIRA — uma compra nesse dia já entra no
  ciclo novo, o de maior prazo. O ciclo vai do `best_purchase_day` de um mês até a véspera dele no mês
  seguinte; `1` = ciclo igual ao mês-calendário. A migration converteu os valores existentes
  (`best_purchase_day = closing_day + 1`), então **o usuário vê um número diferente do que cadastrou** —
  quem tinha fechamento 3 agora tem melhor compra 4. Renomeado em `TCreditBalance`/`TCreditBalanceBody`
  (`packages/shared`), nos dois formulários do web (`CreditBalanceFormDialog`, `NewCardDialog`), nos dois
  do mobile (`CreditBalanceFormModal`, `NewCardModal`) e no `TCreditBalanceForm` de
  `apps/mobile/src/types/forms.ts`. Rótulos: "Dia de fechamento" → "Melhor dia de compra" (web),
  "Fechamento *" → "Melhor compra *" (mobile).
- **`Transaction` ganhou `invoice_month`** (`"YYYY-MM"`, nulo em transações de conta) e a **regra de ouro
  inverteu**: quem define a fatura de uma transação é esse campo gravado nela, NÃO uma conta de datas.
  O ciclo do cartão só calcula o *default* do campo e as datas exibidas (`cycle_start`/`cycle_end`/
  `due_date`). `TCurrentInvoice` também ganhou `invoice_month`, e `TCreateTransactionBody`/
  `TUpdateTransactionBody` aceitam `invoice_month` opcional — dá pra jogar uma compra pra outra fatura
  sem mexer na data dela (útil pra parcelamento e compra lançada fora do ciclo). Os dois formulários de
  transação (`TransactionFormDialog` no web, `TransactionFormModal` no mobile) têm, só em cartão, o
  checkbox **"Fatura automática — pelo ciclo do cartão"**, marcado por padrão; desmarcando, aparecem dois
  seletores independentes, **Mês** (os 12) e **Ano** (dois pra trás, o atual, dois pra frente). O estado
  guarda um só campo, `invoice_month`: ou a sentinela `AUTO_INVOICE_MONTH` (o Select do Radix não aceita
  item com value vazio), ou o `"YYYY-MM"` composto pelos dois seletores. "Automática" vira `''` no UPDATE
  (é assim que o backend devolve o campo pro default) e some no CREATE. Os nomes dos meses vêm do
  `MONTH_NAMES_PT` exportado por `packages/shared/src/utils/invoice.ts`, e o ano do valor atual entra na
  lista mesmo fora da janela de 5 anos, pra uma transação em fatura antiga não abrir com o select vazio.
  Uma transação de cartão carregada pra edição vem com o mês concreto, ou seja, **desmarcada** — mudar a
  data NÃO move a fatura (mesmo comportamento de antes, já que o backend só calcula o default quando o
  campo está em branco); pra fazer a fatura voltar a seguir a data, marcar "Fatura automática".
  `apps/mobile/src/utils/invoice.ts` re-exporta o util de fatura do shared, no padrão dos outros utils.
  - **Navegação de fatura voltou pra `reference`.** Com `invoice_month` na resposta, a âncora deixou de
    ser o mês do `cycle_end` (que exigia adivinhar o vencimento) e virou o próprio `invoice_month` da
    `current_invoice`: `InvoiceUtils.shiftMonth(invoice_month, cycle_offset)` → `reference: "YYYY-MM"`.
    Isso apagou os dois helpers de heurística (`dateForOffset`, `dueLabelForOffset`) dos dois
    `CreditBalanceList` e o rótulo de fallback virou `InvoiceUtils.monthLabel(invoice_month)` — sem o
    chute de "vencimento ≈ fechamento + 1", porque o `invoice_month` **já é** o mês do vencimento.
    `PayInvoiceDialog`/`PayInvoiceModal` passaram a receber `reference` em vez de `date` e mandam
    `reference` no `pay_invoice` (o backend prioriza ele sobre `date`).

**Ajustes de UX do formulário de transação (2026-09-06, web + mobile):**
- **"Data prevista" virou "Data da transação"** nos dois tipos de origem (era ternário por `is_credit`),
  nos quatro lugares: `TransactionFormDialog`/`TransactionDuplicateDialog` (web) e
  `TransactionFormModal`/`TransactionDuplicateModal` (mobile), incluindo o título do calendário do mobile.
- **Horário nasce com a hora de AGORA**, não 00:00. A data sugerida (o dia que a lista está mostrando)
  é do DIA, não da hora — antes o lançamento nascia meia-noite, o que bagunçava a ordenação e o "Pago em",
  que herda esse horário. Helper `DateUtils.withCurrentTime` no `packages/shared` (web); no mobile, que
  guarda data e hora em campos separados, o efeito de criação usa `nowParts().time`. Vale também na
  DUPLICAÇÃO: a cópia é um lançamento novo, então não herda o horário da original (que podia ser 00:00).
- **"Marcar como pago" pré-preenche com a data/hora da transação**, não com "agora" — o caso comum é
  registrar algo que já foi pago na hora em que aconteceu.
- **"Conta" e "Tipo" na mesma linha** quando a origem não é cartão (em cartão a origem ocupa a linha
  toda, porque logo abaixo vem o campo "Cartão"). No mobile isso fica apertado em tela estreita: os dois
  selects dividem ~50% cada.
- **Edição: fatura sem checkbox e origem trocável (2026-10-03).** Na edição de transação de cartão, o
  checkbox "Fatura automática" não aparece: os seletores Mês/Ano vêm direto com o `invoice_month` gravado
  (o backend sempre grava o mês concreto, então o checkbox vinha sempre desmarcado e não ajudava em nada —
  ele existe pra criação, pro usuário não precisar pensar na fatura). A **origem** também passou a ser
  editável: o select lista contas E créditos (web: `SelectGroup` "Contas"/"Créditos"; mobile: Picker com
  prefixo "Conta · "/"Crédito · ") e, se a origem muda, o update manda `source_type`/`source_id`,
  `credit_card_id: ''` ao sair de um crédito, e o checkbox "Fatura automática" volta (marcado) — a fatura
  antiga não vale pra outro cartão. Voltar pra origem original restaura cartão e fatura gravados.
  **Exceção:** transação de pagamento de fatura (`paid_credit_balance_id` preenchido) tem a origem travada
  (select desabilitado + aviso) — ela é amarrada à fatura que quitou, e trocar a conta ou virar gasto de
  crédito deixaria esse vínculo incoerente. O backend ainda não bloqueia isso sozinho; a trava é só no front.
  O backend passou a aceitar `source_type`/`source_id` no `update` (`dev` 3db1ad7): zera e recalcula
  `credit_card_id`/`invoice_month` pela nova origem (o que vier no mesmo payload prevalece) e, de conta pra
  cartão, efetiva na `transaction_date`.
- **`Select` do Radix dentro de `<form>` zera o valor se as opções chegam depois** (web): o Radix espelha
  o `value` num `<select>` nativo escondido e dispara `change` a cada troca; sem o `<option>` ainda
  carregado, o nativo cai em `''` e o Radix chama `onValueChange('')`. Sintoma: na 1ª abertura da edição o
  campo "Crédito" vinha vazio (a 2ª funcionava, com a lista já em cache). Fix no `TransactionFormDialog`:
  ignorar `''` no `onValueChange` (nenhum item tem value vazio). Vale pra qualquer `Select` novo com opções
  assíncronas dentro de form.
- **Transferência entre contas (2026-10-03, web + mobile; backend `dev` 3db1ad7).** É uma transação
  comum com `kind: 'transfer'` — UM registro só, não um par saque/depósito — com origem `Account` e
  `destination_account_id` (pode ser conta de outra carteira acessível). A resposta traz também
  `source_name` (em toda transação) e `destination_account_name`. O `value` é sempre positivo e **o sinal
  depende de quem olha**: `TransactionUtils.direction(t, account_ids)` (shared) devolve `in`/`out`/
  `internal` a partir das contas que a visão enxerga (na Home, as contas da carteira) — origem visível =
  saída, destino visível = entrada, as duas = movimento interno (sem sinal, ícone `ArrowLeftRight`/
  `swap-horiz` em azul, fora das somas de entrada/saída do card de total; `total_settled`/
  `total_projected` já vêm certos do backend). O chip de origem vira "X → Y". Formulário: na criação, "Transferência"
  é a 3ª opção da etapa 1 (Conta / Cartão / Transferência; exige 2 contas na carteira) — vira uma conta com
  `kind: 'transfer'`, campos "Da conta" + "Para a conta" (contas da carteira menos a origem) e SEM o select
  Tipo; o Tipo de "Conta" fica só Entrada/Saída. **Transferência NÃO é editável** (regra do dono): a lista
  não oferece "Editar" pra ela (web: item some do menu; mobile: some do action-sheet e o toque no card abre
  as ações em vez da edição) — só Duplicar, Efetivar/Desfazer e Excluir. Pelo mesmo motivo, o Tipo na edição
  de uma entrada/saída também não oferece "Transferência". Duplicar copia o destino. **Pendente:**
  escolher como destino uma conta de outra carteira na criação (hoje o select só lista a carteira atual).
  - **Descrição opcional em transferência** (form e duplicar): em branco, o front MANDA EM BRANCO e o
    backend (b7242bf) gera "Transferência <origem> -> <destino>" — no update, regenera com as contas atuais.
    `TransactionUtils.transferDescription` (shared) reproduz o formato só pro placeholder. No Duplicar o
    campo vem preenchido com a descrição que veio da API.
  - **Origem excluída** (backend b7242bf): excluir conta/carteira não apaga mais as transações. A lista
    mostra "<nome> (excluída)" quando a transação é DESTA carteira e a origem não está mais entre as
    ativas — origem de outra carteira (transferência recebida) não dá pra distinguir, fica só o nome.
  - **Autor (`user_id`) no create/update — NÃO implementado:** o backend aceita, mas não existe endpoint
    que liste os membros (convites aceitos) de uma carteira (`GET /user_wallets` só traz os convites
    PENDENTES do próprio usuário). Precisa disso no backend antes de montar o seletor.
  - **Valor nas opções de origem/destino** (qualquer tipo de transação): conta mostra o saldo (`balance`,
    em vermelho se negativo no web) e crédito mostra "fatura R$ X" (`current_invoice.remaining` — o que falta pagar; sem pagamento parcial é igual ao `amount`), vindos das
    mesmas listagens que o form já busca. No web vai como `<span>` dentro do `SelectItem`; no mobile, no
    texto da opção do Picker ("Itaú — R$ 1.234,00"), que não aceita marcação.
- **Altura dos campos**: o botão "Marcar como pago" (web) usava a altura padrão do `Button` (36px) e
  destoava dos inputs (40px) — ganhou `FIELD_METRICS` (ver `apps/web/src/components/ui/field.ts`).

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
- **Navegação** (`src/components/organisms/{Sidebar,BottomNav,NavMenu}`, `src/hooks/useNavItems`) —
  **redesign 2026-11, três layouts escolhidos no `DefaultTemplate` por `useMediaQuery`**:
  - **Desktop (≥1280px)**: `Sidebar variant='full'` (260px): `Logo` horizontal, `WalletSwitcher`,
    destinos, Nova Carteira e, no rodapé, cartão do usuário (leva a `/settings`) + Sair.
  - **Tablet (768–1279px)**: `Sidebar variant='rail'` (84px), só ícones (com `title`/`aria-label`). O
    botão redondo na borda direita da barra (`onToggle`) recolhe/expande no tablet e no
    desktop; a escolha fica em `localStorage` (`sidebar-collapsed`) e, sem escolha salva, o desktop abre
    expandido e o tablet recolhido. Já tentaram tirar esse botão e
    deixar só o tamanho da tela decidir — o dono usa e pediu de volta.
  - **Celular (<768px)**: `BottomNav` **flutuante** (pílula de vidro `fixed`, só ícones com
    `aria-label`): Início, Contas, "+" central (só na Início), Carteiras e Menu (bottom sheet com o
    `NavMenu`). Pontos de troca: 768/1280 — mudou um, mude o outro (`DefaultTemplate`).
  - **Janelas menores (2026-11-22, mockups v3 "Dlg*")**: todas no casco `molecules/SheetDialog` — no celular folha de
    vidro (8px das bordas, raio 32, alça, um botão principal de largura total, SEM "Cancelar": fecha pelo × e por
    fora); do tablet em diante diálogo de vidro de 560px (`wide` = 600) com "Cancelar" + principal à direita e ação
    extra à esquerda. Peças: `Field`, `FIELD_INPUT`, `AffixInput` (prefixo/sufixo — o `prefix` nativo do input sai do
    tipo), `RadioCard` (opção única; `warning` = opção perigosa), `Notice`, `SummaryTile`. Use-as em toda janela nova.
    **Edição aproveita o que o backend aceita (2026-11-22)**, não só o que o app antigo fazia: recorrência edita data da
    próxima (`start_date` + `effective_from` = próxima original), cartão, responsável e, na parcelada, total e nº de
    parcelas; pagar fatura tem descrição opcional e avisa quando passa do restante; importação já vem com o
    `adjust_balance` salvo no vínculo; saldo inicial da conta pode ser negativo ("Está negativo?"); o melhor dia de compra de um cartão do banco já confirmado
    aparece no vínculo com "Mudar" (`PATCH /bank_account_links/:id best_purchase_day`); limite de crédito
    ligado ao banco avisa que a próxima atualização o troca; dígitos do cartão explicam o casamento das compras do banco.
    Fora de propósito: editar transferência e "Fatura automática" na edição (decisões do dono, ver abaixo).
    Botão principal diz o que faz ("Criar conta", "Pagar R$ X"). Na conferência o tipo é Saída/Entrada (não o
    `translated_kind` da API). Textos sobre regra de backend só se confirmados (ex.: "ajustar o saldo" não diz COMO).
  - **Menu redesenhado (2026-11-22, mockup v3 "Menu")**: peças em `molecules/NavKit` — `GLASS_PANEL`/`GLASS_TILE`
    (vidro), `useLiquidBlob` + `LiquidBlob` (a "gota" que mede o alvo e escorre até ele; estica na direção do
    movimento — keyframes `nav-blob-*` na horizontal e `nav-blob-v-*` na vertical), `WalletPanel` (troca de carteira),
    `ThemeSwitch` (Sistema/Claro/Escuro) e `useRefreshAll`. Celular: a folha do ☰ (`NavMenu`) FLUTUA logo acima da
    barra com a altura do conteúdo (antes era 70% fixo e sobrava metade vazia em aparelho alto), carteiras em cartões
    lado a lado (a em foco vem primeiro — ordem congelada ao abrir; setas ‹ › de vidro nas pontas, só do lado em que ainda há cartão — tem
    gente que não percebe que dá pra deslizar), destinos em grade 2×2, rodapé Configurações/tema/Sair; com ela aberta a
    gota da barra vai pro ☰, que vira ×. A barra fica fora da folha (modal), mas recebe toque mesmo com ela aberta
    (`pointer-events-auto` — o modal do Radix desliga o resto da página): tocar num botão fecha a folha E faz a
    ação dele (o "+" da tela, ou navegar). Só o ☰/× é ignorado no `onInteractOutside`, senão fecha e reabre.
    Tela cheia ou janela fora do template precisa descontar a status bar por conta própria (`--safe-area-inset-top`)
    — o `pt-safe` do template não alcança o portal. Tablets e desktop: `Sidebar` virou painel de vidro flutuante (trilho 76px / barra 260px) com a
    gota no item ativo, carteira em foco no topo (avatar no trilho, cartão com saldo na barra) abrindo o `WalletPanel`,
    e o perfil no rodapé abrindo Configurações/Atualizar dados/Tema/Sair. O antigo `WalletSwitcher` foi apagado.
    O brilho oliva do topo mora na RAIZ do `DefaultTemplate` (atrás do menu também): dentro do `<main>` ele começava
    na borda do trilho e desenhava uma linha vertical no fundo. Recuo dos ícones do trilho = 16px (15px no "+", que tem
    borda) — centro exato em 38 de 76; o botão de recolher fica na altura do logo (aberta, `top: 44`) e centrado na
    linha divisória no trilho (`top: 63`), deslizando entre as duas posições junto com a largura.
    A gota NÃO anima na primeira medida (`animated` no `useLiquidBlob`): ao abrir um painel ela nascia com largura 0
    e crescia com o quique, passando da largura e criando rolagem horizontal. Os painéis também cortam o excesso
    horizontal (`overflow-x-hidden`).
  - **O "+" do meio da barra flutuante é a AÇÃO PRINCIPAL DA TELA (regra do dono, 2026-11-22)**: cada tela — e
    cada aba, quando a tela é a mesma — registra a sua com `usePrimaryAction({ label, onClick })`
    (`context/primaryAction.tsx`): Carteiras = nova carteira; Contas & Cartões = nova conta / novo cartão / nova
    recorrência / conectar banco, conforme a aba; Convites = convidar. Sem registro, a Início cai na nova transação e
    as outras telas ficam sem "+". No celular, o botão equivalente some (`max-md:hidden`) — o do cabeçalho E o tracejado
    no fim da lista ("Nova conta", "Adicionar cartão", "Conectar outro banco"). Não duplique. Fica só o botão do estado
    vazio, que explica o que fazer.
    Formulários que moram dentro de uma aba abrem por um contador (`createRequest`/`connectRequest`) passado pela página.
  - **Puxar pra atualizar (`organisms/PullToRefresh`, 2026-11-23)**: montado no `DefaultTemplate` (vale em toda tela
    logada, inclusive a lista da Início, que rola por dentro), só toque, recarrega o mesmo que "Atualizar dados"
    (`useRefreshAll`). Visual aprovado numa demo à parte: gota de vidro que se forma pendurada no topo, cai, achata e
    boia com o ícone girando; ✓ e some. O dono REPROVOU: esfera com anel em volta ("portal"), poça parada no topo depois
    que a gota solta, ondas tipo sonar e respingos — não reintroduza. Desenho imperativo por rAF (sem state por quadro).
  - **Conteúdo atrás da barra**: só a Início tem altura fixa no template (`h-full`, a lista rola por dentro); as outras
    telas usam `min-h-full`. Com `h-full`, conteúdo maior que a tela vazava da caixa e o padding de baixo
    (`--bottom-nav-space`) ficava no meio — o último item terminava escondido atrás da barra.
  - **"Gota" do item ativo da barra**: pílula de vidro atrás dos ícones que escorre até o destino ao navegar (desliza
    com quique por `cubic-bezier(0.34,1.45,0.64,1)` e estica/achata pelos keyframes `nav-blob-a`/`-b` do index.css,
    alternados pra reiniciar sem remontar). A transição fica em `style` inline: em classe, a duração perdia pra a
    padrão de 150ms do utilitário de transição e a gota "teleportava". Respeita "reduzir movimento".
  - **Vidro da barra**: desfoque moderado (`backdrop-blur-md`) e fundo bem translúcido. Com desfoque forte e fundo mais
    opaco ela virava uma mancha sólida sobre conteúdo simples e perdia o efeito de vidro.
  - **Histórico da barra flutuante**: já existiu uma versão flutuante que foi revertida pra docked
    porque tampava a última transação — dependia de um `padding-bottom` exato no conteúdo, que
    ficava errado quando a barra mudava de altura com o FAB condicional. Ela voltou (pedido do dono)
    com duas garantias: (1) **altura fixa** (`h-[62px]`) — o "+" fica *dentro* da pílula e só a largura
    dele anima, nada mais muda a altura; (2) o espaço ocupado é **uma variável só,
    `--bottom-nav-space`** (index.css), aplicada pelo `DefaultTemplate` como `padding-bottom` do
    conteúdo no celular. Página que rola inteira passa por trás do vidro e o último item para acima
    dela. Lista com rolagem própria (TransactionList) também precisa passar por trás — se a caixa da
    lista terminar acima da barra, o que fica atrás do vidro é fundo sólido e a barra deixa de parecer
    flutuante: a Home soma o padding de volta na própria altura (`h-[calc(100%+var(--bottom-nav-space))]`)
    e põe o respiro no fim da área rolável. Mudou altura,
    distância da borda ou formato da barra? Atualize `--bottom-nav-space` junto.
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
  - **Contas e saldo projetado (`organisms/AccountList` + `CashProjectionChart`, redesign 2026-11)**: cartão
    marinho com o saldo de hoje, gráfico 7/30/90 dias, ponto mais baixo e aviso quando cai/fica negativo;
    contas em linhas (celular) ou cartões com "Fim do mês" (tablet/desktop). **A projeção ainda não existe
    no backend** — o contrato já está definido como se existisse (`TCashProjection` em `api.ts`,
    `GET /accounts/projection` em `routes.ts`, fetcher `getCashProjection`), e o `useCashProjection` usa,
    por enquanto, `estimateCashProjection` (fetchers/projection.ts), que monta a MESMA resposta a partir dos
    endpoints de hoje via `ProjectionUtils.build` (utils/projection.ts — as regras estão no comentário de
    lá). Quando o backend implementar, troca-se uma linha no hook. A chave `QUERY_KEYS.account.get_projection`
    é invalidada em toda mutação que mexe em conta, transação, recorrência ou fatura. A projeção só enxerga
    o que está lançado (pendentes, recorrências previstas e faturas): sem entradas futuras cadastradas, a
    linha só desce.
  - **Cartões (`organisms/CreditBalanceList`, redesign 2026-11)**: cartão selecionado como "cartão físico"
    (degradê do logo), trocado no tablet/desktop pelas setas ‹ › ao lado do nome + pontinhos ("2 de 4") —
    já houve uma lista compacta dos outros cartões, mas o selecionado saía dela e parecia que a lista mudava
    de ordem a cada clique; ao lado (≥1024px) ou embaixo, o detalhe dele
    (`CreditBalanceDetail`, com `key` = id pra zerar a navegação de fatura ao trocar): ‹ fatura ›, Pagar,
    ⋮ editar/excluir crédito, total/limite/ciclo, plásticos e "Nesta fatura" (compras via
    `useListTransactions` com `source_type/source_id` — só leitura, agrupadas por dia com o mesmo
    `util/groupTransactionsByDay` da Home e dias recolhíveis). Celular: carrossel com scroll-snap; o
    cartão no centro vira o selecionado, e um efeito (com `ResizeObserver`, porque o carrossel fica
    `md:hidden` e reaparece ao mudar o tamanho da tela) leva o carrossel até o selecionado quando ele muda por
    fora. Compras em LISTA, não tabela (mesma decisão da Home). Bordas: `border-border` não aceita `/60`
    — com modificador o navegador cai no branco.
  - **Configurações (redesign 2026-11, `pages/settings`)**: desktop/tablet deitado = menu de seções (Conta, Aparência,
    Carteira principal, Conexões com o Claude, Integração bancária, Sobre) com resumo de cada + o conteúdo; tablet em pé
    = tudo empilhado; celular = lista agrupada que abre cada item numa tela com "Voltar", "Sair da conta" e a linha
    "Sobre". Conta = cartão marinho do perfil ("Membro desde", carteira principal) + `AccountInfoForm` e
    `AccountPasswordForm` lado a lado (cartões; senha valida 6–128 com o `passwordProblem` do AuthForm). Carteira
    principal muda aqui (`PATCH /users/me main_wallet_id`). `ClaudeConnections`: endereço do MCP; do tablet deitado em
    diante a atividade da conexão escolhida num painel ao lado (filtro por ferramenta, argumentos ao abrir, "Carregar
    mais" aumenta o `per_page`); no celular abre por dentro do cartão (3 últimas + "Ver toda a atividade"). O
    `token_hint` da API é o COMEÇO do token (ex.: `mfc_ePPDAJ`) — exiba `mfc_ePPDAJ…`, não "•••• final".
    Transições: no celular/tablet em pé a tela da seção entra pela direita e a lista volta pela esquerda; no desktop a
    gota (`useLiquidBlob`) escorre no menu e o conteúdo entra com fade. A página fica num `overflow-x-clip` (com
    `overflow-clip-margin` de 1rem, pras sombras) — sem isso o deslize dava rolagem horizontal ao `<main>`.
    A seção aberta mora na URL (`?section=password`), não num state: no celular/tablet em pé abrir uma seção empilha
    uma entrada no histórico, então o voltar (gesto, navegador ou Android) fecha a seção — com state ele pulava pra
    tela de antes das Configurações. No desktop a troca no menu usa `replace` (é aba, não navegação).
    "Sobre": no app, a versão da loja (`App.getInfo()` do `@capacitor/app`: 0.3.105, build 105); no navegador,
    `0.3` + data do build (`__APP_BUILD_DATE__`). O `0.3` é o major.minor do `version` de `apps/web/package.json` —
    fonte única, o `android-cd.yml` lê dali o prefixo do versionName. A API segue com branch · commit (não tem versão).
  - **Convites (redesign 2026-11, `InvitesList`)**: pendente num cartão marinho (quem convidou, carteira, há quanto
    tempo, Recusar/Aceitar); recusar pede confirmação (folha no celular). A API só lista os PENDENTES, então o convite
    aceito some da resposta — ele fica nesta tela, nesta visita, em "Aceito agora" (estado local) com "Visualizar
    agora" e "Definir como principal". "Como funcionam os convites" ao lado (desktop) ou embaixo (tablet); no celular,
    só a nota do e-mail. O "+" da barra é "Convidar": convite pra carteira em foco se você administra; senão, Carteiras.
    Convites enviados não existem na API.
  - **Carteiras (redesign 2026-11, `WalletList`)**: a carteira em foco (a do contexto, `useWallet()`) num cartão
    marinho com selos Principal/Compartilhada, saldo efetivado, membros (`GET /wallets/:id/members`, por `useQueries`
    com a chave `wallet.get_members`) e as ações de quem administra; as outras em lista (celular, tablet deitado) ou
    cartões (tablet em pé, desktop) com "Visualizar" (só troca o contexto, não salva nada). Convites recebidos viram
    faixa (celular/tablet em pé) ou botão no cabeçalho. Excluir mostra tudo o que vai junto (contas, cartões, conexões e
    quem perde acesso). Textos sem gênero: "você administra", "de Jéssica", selo "Admin" — não "dono/dona" (não
    sabemos o gênero de ninguém). `TWallet.total` pode ser negativo e o `MoneyUtils.formatMoney` TIRA o sinal: use o
    `signedMoney` local. A API não tem remover membro, sair da carteira nem transferir — não desenhe.
  - **Bancos (redesign 2026-11, `BankConnectionList` + página `bank-connection`)**: cartão por conexão com status em
    palavras (`BankConnectionUtils.statusView`: "Em dia", "Precisa entrar de novo"...) e "atualizado há X" pelo
    `last_imported_at` mais recente dos vínculos (`lastUpdatedAt`) — o backend NÃO grava `last_synced_at`, por isso
    antes aparecia sempre "Ainda não atualizada". Os vínculos de cada conexão vêm por `useQueries` com a mesma chave
    do `useIndexBankAccountLinks` (cache compartilhado com "Contas do banco"). "Para conferir" lista contas/cartões
    com `pending_match_reviews_count > 0` e abre o `MatchReviewDialog`. "Conectar banco" fica no cabeçalho da página
    (incrementa `connectRequest`); o widget da Pluggy mora em `hooks/useBankConnectWidget` (lista e detalhe usam).
    Detalhe: cartão marinho da conexão, um card por vínculo (sem destino = três opções à vista; ignorado = recolhido
    com "Mudar"; cartão mostra crédito disponível/fechamento/vencimento do `external_data`, em REAIS) e, do tablet
    deitado em diante, o histórico do card selecionado num painel ao lado (`BankImportHistoryList`, `compact` no
    tablet); abaixo disso, o histórico abre em folha. Número de cartão sai mascarado ("•••• 4821"); de conta, como o
    banco manda. Peças comuns em `util/bankView.ts`, logo em `molecules/ConnectorLogo` (iniciais na cor da marca).
  - **Autenticação (redesign 2026-11, `templates/Auth` + `organisms/LiquidBrand` + `molecules/AuthForm`)**: fundo
    líquido marinho/petróleo/oliva com o losango do logo em "vidro", desenhados por UM shader WebGL2
    (`LiquidBrand/shader.ts`, 3D simulado — sem Three.js, de propósito, pra pesar poucos KB). O shader mede a cada quadro
    um bloco vazio do tamanho do ícone (`markRef`) e desenha o losango ali; só o nome é imagem (`Logo variant='wordmark'`).
    Desktop/tablet deitado: painel da marca à esquerda + formulário à direita; tablet em pé: cartão de 460px sobre o
    líquido; celular: folha presa embaixo. Mexe com o ponteiro e, no celular, com o giroscópio (no iPhone só depois de
    permissão, pedida no primeiro toque no fundo). Já testamos um fundo "mais líquido" (relevo + brilho + ondas) e o dono
    achou enjoativo — ficou o de fumaça. O mesmo shader está no canvas do mockup: mudou um, mude o outro. Em dev o
    StrictMode monta duas vezes: NÃO chame `loseContext()` na limpeza (o canvas devolve o mesmo contexto já perdido e o
    fundo fica branco). Regras: senha de 6 a 128 checada no cliente (a mensagem da API pode vir em inglês); cadastro
    entra sozinho logo depois (a API não devolve token, então chama o sign-in com a mesma senha); "Esqueci a senha"
    fica na tela e mostra pra onde foi o link; o link do e-mail é `/auth/change-password/:token` (rota nova —
    `/auth/reset-password?token=` continua valendo).
  - **Detalhe da transação (`organisms/TransactionDetailSheet`, redesign 2026-11)**: tocar na linha abre;
    painel flutuante à direita (460px) no tablet/desktop e tela cheia no celular. Só mostra e repassa as
    MESMAS ações do "⋮" (a lista executa; editar/duplicar/excluir fecham o Detalhe antes). A lista guarda só
    o `detail_id` e relê a transação dos dados atuais — efetivar/desfazer aparece na hora, e se ela some
    (excluída) o painel fecha. O "⋮" da linha tem `stopPropagation` (os itens do menu estão num portal, mas
    na mesma árvore React, e o clique subiria até a linha). Celular usa linha do tempo (Criada → Vence →
    Pago); tablet/desktop usam grade de fatos + "Criada em · editada em" (`created_at`/`user_edited_at`).
  - **Cartões na Início seguem o mês de VENCIMENTO, e isso vai virar toggle (pendente, 2026-11-23)**: hoje a aba
    Cartões, o card "Faturas do mês" e o chip "faturas em aberto" usam `reference` = mês exibido = faturas que
    VENCEM nele (em novembro aparecem as compras de outubro). Pra ver o gasto do mês atual era preciso ir pro mês
    seguinte. Decidido com o dono: toggle "Vencendo no mês / Em aberto" (padrão "Em aberto"), com a regra toda no
    backend — o front só manda o modo e mostra. Issues no my-finance-api: #18 (`users.preferences` jsonb, chave
    `home_credits_by`, sem validação por enquanto), #19 (`credits_by` no `GET /transactions`), #20
    (`credits.invoices`, resumo das faturas na resposta — tira a chamada por cartão do `useGetInvoicesForMonth`).
    O card de destaque não muda (só contas). A tela Cartões já mostra a fatura aberta (`current_invoice`).
  - **Home no tablet deitado (1024–1279px) tem layout próprio, como no mockup**: destaque + card
    Entrou/Saiu empilhados + card Pendente em cima; lista + "Faturas do mês" numa coluna de 320px embaixo.
    O tablet em pé empilha tudo e o card de faturas vira resumo + cartões em duas colunas (`md:max-lg:`).
  - **Troca de mês com efeito líquido (`hooks/useMonthTransition`, 2026-11-22)**: setas e "Hoje" em qualquer tamanho;
    arrastar a lista pros lados só no celular e nos tablets (até 1279px — só eventos de toque). O conteúdo sai pro lado
    ondulando (filtro SVG `#month-liquid`: turbulência + deslocamento, criado uma vez no `<body>`, ligado só durante a
    animação) e esticando de leve, o mês troca e o novo entra pelo outro lado com quique. O gesto só é assumido quando
    é claramente horizontal. Distorção forte (escala ~46, frequência alta) rasgava as bordas dos cartões e parecia
    defeito — ficou em escala 26 e ondas largas. Os cartões de resumo do topo não animam (trocam o valor na hora).
    Contagem exata: o `changeMonth` usa a forma funcional do `setMonthYear` (nunca o mês de uma closure — no app
    antigo isso fazia o gesto "pular" meses ao ir e voltar) e um clique/gesto DURANTE a animação troca o mês na hora em
    vez de ser ignorado. Testado: +3/−4/+1, 4 arrastos em 0,4s, 5 cliques em 0,3s — cada pedido anda exatamente um mês.
  - **Mesma lista agrupada por dia em todos os tamanhos (redesign 2026-11)** — no desktop ela fica dentro
    do cartão com as abas Contas/Cartões e o contador, e só o corpo do cartão rola. Já existiu uma tabela
    no desktop (Data | Descrição | Conta | Valor, ordenável por coluna); o dono achou esquisita e pediu a
    lista do celular no lugar, então a ordenação por coluna saiu junto. Não reintroduza a tabela.
    **Todo dia começa recolhido (2026-11-23, pedido do Gabriel)**, inclusive os de uma transação só: o cabeçalho
    mostra dia, contagem e total, e abre ao tocar. Vale também pro "Nesta fatura" dos cartões.
  - **Nova transação no visual do mockup (redesign 2026-11, `TransactionFormDialog`)** — só a apresentação
    mudou; salvar/editar/repetir/escopo seguem iguais. Não existe mais a "etapa 1" (Conta/Cartão/
    Transferência): o **tipo vem primeiro** (abas Saída/Entrada/Transferência no MESMO `SegmentedControl` do resto do app — já teve um grupo de abas próprio em marinho e o dono pediu padrão; segmento indisponível usa `disabled`/`title`) e define as
    origens possíveis (saída e entrada: contas e cartões — entrada no cartão é estorno/crédito, desconta da fatura,
    sem "Parcelado"; transferência: só contas — trocar o tipo limpa uma origem que não vale mais). Os campos viraram **chips** com popover (Origem/De, Para, Cartão quando o
    crédito tem mais de um, Quando, Pagamento só em conta, Fatura só em cartão, Responsável quando a
    carteira tem mais de um membro) — cartões com rótulo em grade de 2 colunas em todos os tamanhos (no celular,
    Origem/Para e o Pagamento já pago ocupam a linha inteira, com `grid-flow-row-dense`); o ícone só aparece quando
    informa algo (bolinha conta/cartão, pendente/pago); Repetir e
    Rascunho são chips tracejados de liga/desliga, e o painel do Repetir abre inline. Dentro de popover
    **não use o `Select` do Radix**: a lista dele abre num portal fora do popover e o clique fecha o
    popover — por isso fatura (mês em grade + ano com setas) e as listas de origem/cartão/responsável são
    botões. **Valor = teclado numérico do SISTEMA** (`inputMode='numeric'`, 2026-11-22): o valor grande é um
    `<input>` de verdade (largura do texto via `field-sizing: content`, alinhado à direita pro cursor do campo
    vazio ficar onde os dígitos entram). A vírgula é AUTOMÁTICA (`changeValue`: só dígitos, entram pelos centavos,
    máx. 11) — já existiu vírgula manual e o dono pediu a máscara. Nova transação abre com o valor em foco
    (`onOpenAutoFocus`); na edição nada ganha foco, pra o teclado não subir. "Próximo" do teclado leva pra
    descrição. **Já existiu um teclado numérico próprio** fixo na metade de baixo (como no mockup antigo): o dono
    pediu o do sistema — ocupava a tela o tempo todo e não vibrava (`navigator.vibrate` exige a permissão
    `VIBRATE`, que o app não declara). Não reintroduza. O Salvar fica preso embaixo; com o teclado aberto o
    `SystemBars` do Capacitor 8 encolhe a WebView pela altura dele, então o botão sobe junto.
    **Layouts:** celular = tela cheia; tablets = o mesmo formulário de toque (valor grande, descrição, cartões,
    Salvar) num diálogo de 560px — o tablet deitado tinha duas colunas por causa do teclado e virou igual ao em
    pé; desktop (≥1280) = campos digitados (Valor/Descrição) e cartões em grade, com Cancelar/Salvar no rodapé.
    O chip Repetir é quem liga/desliga; o painel não tem
    "Não repete". Abas de tipo usam Saída/Entrada (o enum da API diz Saque/Depósito). ⌘/Ctrl+Enter salva.
    **Duplicar = este mesmo formulário** (`duplicateFrom`, 2026-11-22): abre como NOVA transação já preenchida com a
    original (valor, tipo, origem, cartão, destino, rascunho, responsável), data +1 mês com o MESMO horário da
    original (se ela estiver em 00:00 — transação antiga, de antes do campo de hora — usa o horário de agora;
    isso substitui a regra antiga de "a cópia sempre nasce com a hora de agora", da seção de 2026-09-06),
    pendente, fatura automática, sem repetir — tudo editável, título "Duplicar transação", botão "Duplicar saída",
    sem foco inicial (o ajuste comum é a data). Já existiu uma janela própria (`TransactionDuplicateDialog`, apagada)
    com valor/tipo/conta travados e só descrição e datas editáveis; o dono achou feia e destoante do formulário.
    Menções a ela nas seções antigas deste arquivo são históricas.
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
  - **Segue o sistema por padrão (redesign 2026-11):** o contexto guarda uma *preferência*
    (`system`/`light`/`dark`, `setPreference`) e expõe o `theme` já resolvido; em `system` acompanha o
    `prefers-color-scheme` em tempo real. A preferência fica na chave `theme-preference` — a antiga
    `theme` foi abandonada de propósito, porque gravava "light" na primeira visita de todo mundo e
    impediria usuários existentes de seguir o sistema. `index.html` tem um script inline que aplica a
    classe `.dark` antes do React montar (mesma regra), para não piscar o tema errado; mudou a regra
    num lado, mude no outro. A escolha fica em Configurações → Aparência (Sistema/Claro/Escuro).
  - As variáveis CSS do shadcn (`--background`, `--primary`, `--secondary`, etc., em
    `src/styles/index.css`, dentro de `:root`/`.dark`) são `brandTheme`/`brandPalette` de
    `packages/shared/src/tokens.ts` (paleta do redesign) **convertidos pra HSL** — se mudar um valor
    lá, recalcule o HSL e mude aqui também, os dois lados não sincronizam sozinhos. Além das do
    shadcn existem papéis próprios: `sidebar`, `brand` (oliva legível como texto), `success`,
    `warning` (+`warning-dot`), `info`, `danger`, cada um com `*-soft` (fundo translúcido, ex.
    `bg-success-soft text-success`), e as fixas da marca `navy`/`navy-light`/`teal`/`sand-light`
    (iguais nos dois temas). Use esses papéis em vez dos tokens planos antigos (`feedback-*`,
    `brand-secondary`, `background-default`…), que não acompanham o tema. As cores aceitam
    modificador de opacidade (`bg-primary/15`), **exceto** `border`, `input` e os `*-soft`, cujas
    variáveis já carregam o alfa. `primary-foreground` é marinho nos dois temas: o oliva não tem
    contraste com texto branco.
  - **Fonte: Geist** (`@fontsource-variable/geist`, importada em `src/index.tsx`), com números de
    largura fixa (`tnum`) no `body`. `font-noto-sans`/`font-roboto` viraram apelidos da Geist só para
    não quebrar quem ainda os usa; a Noto Sans e os 12 MB de arquivos dela foram removidos.
  - **Logo**: SVGs em `src/assets/brand` (ícone redesenhado em geometria + nome traçado do PNG
    original, com variante clara para fundo escuro), sempre via o átomo `components/atoms/Logo`
    (`icon`/`horizontal`/`stacked`, prop `onDark` para fundo marinho fixo). No escuro o ícone ganha um
    quadrado areia por trás, porque o quarto marinho dele some sobre fundo escuro.
  - **Componentes base do redesign** (`components/ui`): botões em pílula (`rounded-full`; variantes
    `default` oliva, `navy` marinho fixo para seleção forte, `secondary`, `outline`, `ghost`,
    `destructive`, `link`; tamanhos 32/40/48px); campos com 44px, raio 16px e foco com anel oliva
    suave, todos via `ui/field.ts` (`FIELD_SURFACE`/`FIELD_METRICS`) — `atoms/TextInput` também usa
    o `FIELD_SURFACE` agora, para input/select/data/TextInput baterem; `Card` com raio 24px;
    diálogos/painéis com fundo `bg-card`, raio 24px, fundo escurecido marinho e botão de fechar em
    círculo; `SegmentedControl` em pílula com o item ativo oliva (`bg-primary`) e texto marinho, como no mockup; `ui/badge` (`Badge`, variantes
    `neutral`/`outline`/`brand`/`success`/`warning`/`info`/`danger`, prop `dot`) para selos como
    "pendente"/"prevista"/"2 para conferir" — use-o em vez de `span` com classes de cor à mão.
  - **`hover:` só com mouse** (`future.hoverOnlyWhenSupported` no tailwind.config, 2026-11-22): no celular/Capacitor o
    último elemento tocado ficava "em hover" e o fundo grudava (linhas da lista). Feedback de toque é `active:`/`pressable`.
  - **Toque "nativo" = classe `pressable`** (`index.css`): afunda pra 0,96 ao pressionar e volta com mola,
    sem o flash cinza de toque e sem atraso de duplo toque. Já vem na base do `ui/button`; em botão feito à
    mão (chips, teclado, abas, itens de lista) aplique `pressable` em vez de só `transition-colors` — o dono
    reclamou que os cliques estavam "duros". Evite em elemento que já usa `transform` pra se posicionar
    (o `:active` troca o transform).
  - **Ao mexer em `src/util/tokens.ts` (fontes, escalas), reinicie o `webapp:dev`**: o Tailwind importa
    esse arquivo na config e o Vite não o observa, então o servidor segue com a config antiga (já deu
    `The font-sans class does not exist` no dev com o build passando).
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

**Recorrências e conciliação com o banco (2026-11-07, web + mobile; backend `feature/recorrencias`):** o
backend unificou compras parceladas e lançamentos recorrentes num modelo só (`Recurrence`) e passou a
conciliar a transação que chega do banco com o que já estava lançado. *Breaking* no contrato:
- **Saíram** `installment_group`, `installment_review`, `projected_installment`,
  `pending_installment_reviews_count`, `GET /transactions/pending_installment_reviews` e
  `POST /transactions/:id/resolve_installment_review`. **Entraram** em `TTransaction`: `recurrence_id`,
  `recurrence_index`, `recurrence_type`, `projected` (ocorrência PREVISTA — gerada pela recorrência ou parcela
  que o banco ainda não lançou), `match_review` e `user_edited_fields` (o banco não sobrescreve esses campos,
  mas segue atualizando os outros); `pending_match_reviews_count` em `TAccount` e `TCreditBalance`;
  `matched_count` em `TBankImport` (o `importSummaryMessage` já mostra "N conciliadas").
- **Shared:** `TRecurrence`/`TMatchCandidate`/`TPendingMatchReview`, fetchers `fetchers/recurrences.ts` e
  `indexPendingMatches`/`resolveMatch`, `QUERY_KEYS.recurrence.get_all` e `transaction.get_pending_matches`,
  `RecurrenceUtils` (`utils/recurrence.ts`: rótulos de regra, `occurrenceDate`/`dayBefore` em string
  `YYYY-MM-DD` sem passar por UTC), `BankConnectionUtils.matchCandidateLabel`, `PROJECTED_HELP`.
- **Conciliação** (`MatchReviewDialog` no web / `MatchReviewModal` no mobile — substituíram a revisão de
  parcelas): genérico pra conta OU cartão. Abre pelo badge "N para conferir" no card da conta/cartão e pelo selo
  "Conferir" na linha. Candidatos são `transaction` (já lançado: escolher JUNTA as duas) ou `recurrence`
  (compra parcelada da parcela); a última opção é `'none'` ("É uma compra nova" em parcela, "É outra
  transação" no resto).
- **Formulário de transação, criação:** seção "Repetir" (`SegmentedControl`: Não repete / Recorrente /
  Parcelado — este só em cartão). Com repetição o submit chama `createRecurrence` em vez de criar transação, e
  somem "Pago em", Rascunho e fatura manual (as ocorrências futuras são previstas; fatura pelo ciclo).
  Parcelado: o valor digitado é o TOTAL DA COMPRA (vai como `total_value`); o backend divide e põe a sobra dos
  centavos na 1ª parcela, como os bancos — a ajuda mostra "10x de R$ 370,79 (1ª de R$ 370,82)" via
  `RecurrenceUtils.splitInstallments` (antes era o valor da parcela, e 10 × R$ 370,79 perdia 3 centavos).
- **Formulário de transação, edição (2026-11-16):** transação avulsa também tem "Repetir"; salvar faz o update dela e
  depois `createRecurrence({ transaction_id, ...regra })` — ela vira a 1ª ocorrência e herda o resto no backend
  (parcelar: o valor dela vai como `total_value`). Na edição "Pago em"/fatura continuam visíveis (a transação segue
  existindo). Ocorrência de recorrência/parcela mostra a regra (`useShowRecurrence`, `QUERY_KEYS.recurrence.get_one`)
  no lugar do "Repetir"; no web, "Editar regra" abre o `RecurrenceFormDialog` aninhado (no mobile só o texto
  apontando a aba Recorrências — dois `Modal` nativos empilhados quebram, ver acima).
- **"Só esta / Esta e as próximas":** editar descrição/valor de uma ocorrência de recorrência comum
  (`RecurrenceUtils.isRecurringOccurrence`) pergunta o escopo; "próximas" = `updateRecurrence(id, body,
  effective_from = data da ocorrência)` (o backend divide a regra) + update da própria transação se ela já não
  é prevista. Excluir pergunta o mesmo; "próximas" = exclui esta + `end_date = véspera` (ou `deleteRecurrence`
  se for a 1ª ocorrência). Parcela não pergunta (só esta).
- **Aba "Recorrências"** em Contas & Cartões (web `RecurrenceList`/`RecurrenceFormDialog`, mobile
  `RecurrenceList`/`RecurrenceFormModal`): filtro Recorrentes/Parceladas, editar a regra inteira, excluir (para
  de gerar; as previstas de hoje em diante saem). No mobile não há "nova recorrência" ali — nasce no formulário.
  - **Web, redesign 2026-11 (mockup v3):** Recorrentes = lista no celular, tabela do tablet em diante (a coluna
    Origem só no desktop; nos tablets a origem vai embaixo do nome), com o card marinho "Por mês, nas recorrentes"
    (só as mensais de intervalo 1, sem transferências — o resto é citado como "fica fora desta conta") e "Próximas"
    do mês numa coluna à direita a partir do tablet deitado. Parceladas = cartões com barra segmentada "N de M
    pagas", "falta pagar" (desconta a 1ª parcela, que leva os centavos da divisão) e o card "Falta pagar" em cima.
    "Pagas" = parcelas antes da `next_occurrence` (sem próxima = todas) — a API não manda o índice da próxima.
    Busca (`terms`, com atraso de 300ms) e filtro por origem vão pra API; a chave do `useIndexRecurrences` inclui os
    dois. "Nova recorrência" (cabeçalho da página, só nessa aba) abre o `TransactionFormDialog` com
    `defaultRepeatMode` = a aba atual. A edição (`RecurrenceFormDialog`) é folha no celular e tem "Aplicar a
    mudança": todas as previstas ou "De <próxima> em diante" (= `effective_from`). Helpers em `util/recurrenceView.ts`.
    Sem dígitos do cartão nem "na fatura de <mês>" (a próxima ocorrência não traz `invoice_month`) — o mockup foi
    ajustado pra bater.
- Mutações de transação invalidam também `recurrence.get_all` (a "próxima ocorrência" muda).

## Conexões com o Claude (MCP)

O backend expõe um servidor MCP (`<API>/mcp`, OAuth 2.1 com tela de consentimento servida pela própria API —
ver o `CLAUDE.md` do my-finance-api). Os apps só **gerenciam** as conexões, via `GET /v1/claude_sessions`
(lista + `mcp_url`), `GET /v1/claude_sessions/:id/tool_calls` (auditoria) e `DELETE /v1/claude_sessions/:id`
(revoga). Contrato em `packages/shared` (`TClaudeSession`/`TClaudeToolCall`, fetchers `claudeSessions.ts`,
`QUERY_KEYS.claude_session`) e rótulos/regras em `ClaudeSessionUtils` (status, acesso, "último uso",
validade; `isRevocable` = `active`/`pending`).
- **Web**: folha "Conexões com o Claude" nas Configurações (`organisms/ClaudeConnections`) — endereço do MCP
  com copiar, conexões atuais e "Revogadas e expiradas", diálogo de Atividade e `AlertDialog` para revogar.
- **Mobile**: seção "Integrações" nas Configurações (`WalletsSettingsScreen`) abre o
  `ClaudeConnectionsModal` (lista, sub-visão de Atividade dentro do modal, revogar por `Alert.alert`). O
  endereço é `selectable` + botão de compartilhar (`Share` do RN) — **sem `expo-clipboard`** de propósito,
  para não introduzir dependência nativa (exigiria build novo e bump de `version`, não só OTA).

## Casca nativa do web (Capacitor) — substituindo o apps/mobile (2026-11-21, branch `feat/capacitor`)

Decisão do dono e do Gabriel: nada no MyFinance precisa ser 100% nativo, então o app da loja passa a ser o
**`apps/web` empacotado no Capacitor 8** (Android), acabando com a duplicação web → port pro mobile. O
`apps/mobile` (RN/Expo) continua no repo, intacto, até a migração se provar — é o caminho de rollback.
- **Mesmo app da loja**: `appId` = `com.chilllogic.myfinance.app` (o mesmo package do RN) e assinatura com a
  **mesma upload key** do EAS. A 1ª versão (`0.3.0`, `versionCode 100`) foi aceita na faixa de teste interno
  como atualização do app existente. O `versionCode` pulou de 19 (último do EAS) pra 100: **rollback pro RN exige
  antes `npx eas-cli build:version:set -p android` acima do `versionCode` atual do Capacitor** (a Play não aceita
  número menor).
- `apps/web/android/` **é versionado** (no Capacitor ele não é regenerado como no Expo CNG — ajustes nativos
  feitos à mão sobrevivem). `capacitor.config.ts` fica em `apps/web/`; o `dist/` do Vite vai empacotado no APK/AAB
  (não carregamos a URL da Vercel — abre sem rede e não depende do deploy).
- **Comandos** (Capacitor 8 exige **Node ≥ 22**; o nvm daqui costuma estar no 20 — `nvm use 22.16.0` antes):
  `npm run webapp:cap:sync` (build web + `cap sync`), `npm run webapp:android` (sync + abre o Android Studio),
  `npm run webapp:android:bundle` (sync + `bundleRelease` assinado →
  `apps/web/android/app/build/outputs/bundle/release/app-release.aab`). O build embute o `VITE_API_URL`/
  `VITE_API_KEY` do `apps/web/.env` — sem ele o app abre mas não fala com a API.
- **Assinatura de release**: `android/app/build.gradle` lê `android/keystore.properties` (fora do git; modelo em
  `keystore.properties.example`) ou, no CI, `ANDROID_KEYSTORE_FILE`/`ANDROID_KEYSTORE_PASSWORD`/
  `ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD`. A keystore (`android/app/release.p12`, também fora do git) é a
  upload key baixada do EAS (`npx eas-cli credentials -p android`). É **PKCS12**: não tem senha de chave própria —
  `keyPassword` = a mesma senha da keystore.
- **Integração no web** (no-op no navegador, `is_native` de `services/native`): `Native.init()` põe a classe
  `native` no `<html>`; `Native.syncTheme` faz os ícones da status bar seguirem o tema do APP (não o do sistema);
  `hooks/useNativeBackButton` (montado dentro do `<BrowserRouter>`) trata o voltar do Android — fecha a camada
  Radix aberta simulando Escape, volta uma tela, ou minimiza na Home/login.
- **Edge-to-edge**: `viewport-fit=cover` no `index.html` + `SystemBars.insetsHandling: 'css'`. Use as utilities
  `pt-safe`/`pb-safe`/`top-safe-4`/`max-h-safe-screen` do `index.css` (leem `--safe-area-inset-*`, injetado pelo
  Capacitor porque `env()` não vem certo em WebView Chromium < 140, com fallback pra `env()`). Template, BottomNav
  e o sheet do menu já usam. **Modal alto precisa de `max-h-safe-screen overflow-y-auto`** (o form de
  transferência estourava a tela) — hoje só o `TransactionFormDialog` tem; o ideal é ir pro primitivo `ui/dialog`.
- **Ícone**: o Android 8+ usa o ícone ADAPTATIVO (`mipmap-anydpi-v26`), não os PNGs — o `@capacitor/assets` só
  com `icon-only.png` gera os PNGs mas deixa o foreground padrão do Capacitor no adaptativo (ícone genérico). O
  foreground foi gerado à mão (ícone em 72% da camada, fundo `#C5C4BF` = cinza do próprio ícone). Fonte:
  `apps/web/assets/icon-only.png` (192px, herdado do RN — pedir um de 1024px). Splash = fundo liso na cor do app.
- **Perde-se o EAS (Build/Submit/Update/OTA)** — sem OTA: cada merge vira um binário novo na faixa interna.
- **CD: `.github/workflows/android-cd.yml`** — PR mesclado na `main` que mexe em `apps/web/**`,
  `packages/shared/**` ou nas dependências (ou disparo manual) → build web → `cap sync` → `bundleRelease`
  assinado → faixa **interna** da Play. O `versionCode` é o maior já enviado à Play + 1 (consultado na hora pela
  API) e o `versionName` é `0.3.<versionCode>` (prefixo = major.minor do `version` de `apps/web/package.json`, o mesmo que o webapp mostra no "Sobre"). A publicação é
  feita por `.github/scripts/play-publish.mjs` (Android Publisher API, só módulos do Node; roda local também,
  com `PLAY_SERVICE_ACCOUNT_FILE`). Secrets: `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `VITE_API_URL`, `VITE_API_KEY`;
  variável `VITE_WEB_URL`. O `build.gradle` lê `ANDROID_VERSION_CODE`/`ANDROID_VERSION_NAME` (local: 100/0.3.0).
  **O `mobile-cd.yml` ficou só manual**: rodando sozinho, ele publicaria um build RN na mesma faixa interna e
  substituiria a versão Capacitor — é o caminho de rollback (antes, `eas build:version:set` acima do último código).
- **Aviso de atualização** (`organisms/AppUpdatePrompt` + `services/app-update`, só no nativo): a Play
  (plugin `@capawesome/capacitor-app-update`, In-App Updates API) diz se há versão nova → aviso dispensável, uma
  vez por versão ("Depois" grava a versão em `localStorage`); o `apps/web/public/app-version.json`
  (`android.min_version_code`, servido pela Vercel em `${VITE_WEB_URL}/app-version.json`) diz o mínimo aceito →
  abaixo dele, aviso que não fecha. **Suba o `min_version_code` quando uma mudança no backend quebrar versões
  antigas.** Falha aberta: sem `VITE_WEB_URL` ou sem rede, ninguém é bloqueado. "Atualizar" tenta a atualização
  imediata da Play (tela da loja por cima do app) e cai pra página da loja. Checa ao abrir e ao voltar pro app
  (no máximo a cada 30 min). Só funciona com o app instalado PELA PLAY — num APK via `adb` a Play responde
  "sem atualização".
  Visual (2026-11-22, mockup v3 "DlgUpdate"/"DlgUpdateRequired"): casco `SheetDialog` — folha de vidro no celular,
  diálogo do tablet em diante — com a versão atual, o app e o selo Nova/Obrigatória. A obrigatória usa
  `dismissible={false}` (sem ×, não fecha por fora, pelo Escape nem pelo voltar do Android). Para ver no navegador
  (só em dev): `?preview-update=available` ou `?preview-update=required`.
- O CORS do backend aceita qualquer origem — a origem do app (`https://localhost`) funciona sem mudança. API em
  `http://` não funciona (mixed content).
