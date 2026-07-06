# @myfinance/mobile

App mobile do MyFinance, em React Native + Expo (SDK 57, Continuous Native Generation). Faz parte do
monorepo `MyFinanceApps` — rode os comandos a partir da raiz sempre que possível (aliases `mobile:*` no
`package.json` da raiz).

## Setup

Instale as dependências a partir da **raiz do monorepo** (não rode `npm install` aqui dentro):

```bash
npm install
```

### Variável de ambiente da API

Crie `apps/mobile/env.ts` (gitignored, não existe num clone novo):

```ts
export const ENV = {
  API_URL: 'http://sua-api-local:porta',
};
```

Tipado em `env.d.ts`, importado via `@env` (`react-native-dotenv`). Se mudar esse arquivo, reinicie o
Metro com cache limpo (`npm run mobile:start`, que já roda `--clear`).

### Android SDK local

`apps/mobile/android/` **não é versionado** — é gerado via `npx expo prebuild` (disparado
automaticamente se não existir, tanto por `npm run mobile:android` quanto por `expo run:android`
direto). Isso significa que numa máquina nova falta um arquivo que o Gradle precisa,
`android/local.properties` (`sdk.dir=...`), até você fazer uma das duas coisas:

- Abrir o projeto uma vez no Android Studio (ele cria o arquivo sozinho); ou
- Configurar a variável de ambiente `ANDROID_HOME` (ou `ANDROID_SDK_ROOT`) do Windows/macOS/Linux
  apontando pro seu Android SDK — essa sobrevive a qualquer `prebuild` futuro.

Sem isso, `expo run:android` falha com `SDK location not found`.

### iOS

Só é possível buildar/rodar de verdade num Mac (CocoaPods + Xcode). Depois de um `expo prebuild
--platform ios`, os passos são os padrão do Expo/RN:

```bash
bundle install
bundle exec pod install
```

## Rodando o app

Da raiz do monorepo:

```bash
npm run mobile:start        # expo start --clear — só o Metro, escaneie o QR code no Expo Go
npm run mobile:android      # expo run:android — builda nativo, instala e abre no emulador/dispositivo
npm run mobile:ios          # expo run:ios (só Mac)
```

Ou, de dentro de `apps/mobile`, os mesmos comandos sem o prefixo `mobile:` (`npm run start`,
`npm run android`, `npm run ios`).

### Expo Go vs. build nativo

O dia a dia dá pra ser todo feito no **Expo Go** (`npm run mobile:start`, depois escanear o QR code no
app Expo Go do celular ou apertar `a` com um emulador aberto) — não precisa de Android Studio pra isso.
Só é necessário buildar nativo (`expo run:android`/Android Studio) quando:

- for testar de verdade num APK/instalação real (não Expo Go);
- adicionar uma lib com código nativo não suportado pelo Expo Go padrão.

**Importante**: a versão do Expo Go instalada no celular/emulador precisa suportar o SDK do projeto
(hoje, SDK 57). Se aparecer "Project is incompatible with this version of Expo Go" mesmo com o app
"atualizado" pela Play Store, baixe a versão certa direto em
[expo.dev/go](https://expo.dev/go) — o rollout da Play Store costuma atrasar alguns dias depois de um
SDK novo sair.

## Build de release assinado (Play Store)

O build de release é feito via **EAS Build** (configurado em `apps/mobile/eas.json`), não mais
localmente pelo `build.gradle` gerado pelo `expo prebuild` (que não vem com `signingConfigs.release`
nenhum por padrão — builds nativos locais de release usariam a assinatura de debug). A keystore de
produção já está no credential manager do EAS (conta `csjhonathan`, projeto `myfinance`), verificada
contra o fingerprint de **upload key** da Play Console.

```bash
npm run mobile:build          # eas build --platform android --profile production
npm run mobile:build:submit   # o mesmo build + envio automático pra track de teste interno (EAS Submit)
```

`mobile:build:submit` usa `apps/mobile/google-service-account.json` (gitignored, chave de uma conta de
serviço do Google Cloud com permissão só de "Liberar apps para as faixas de teste") pra subir o `.aab`
direto na Play Console via API, sem passo manual. `mobile:build` sozinho só gera o `.aab` — baixe pelo
link impresso no terminal (ou por **expo.dev**, projeto `myfinance`, aba Builds) e suba manualmente se
preferir conferir antes.

O `versionCode` do Android não vem mais do `app.json` — é controlado remotamente pelo EAS
(`appVersionSource: "remote"`, com `autoIncrement` no perfil `production`). Pra consultar ou ajustar:

```bash
npx eas-cli build:version:get --platform android
npx eas-cli build:version:set --platform android
```

## Atualização OTA (EAS Update)

Mudanças **100% JS** (sem lib nativa nova, sem upgrade de SDK do Expo, sem mexer em config nativa) podem
ir direto pra quem já tem o app instalado, sem passar pela Play Store:

```bash
npm run mobile:ota:production -- -m "mensagem descrevendo o update"
```

O `-m` é obrigatório. Isso publica no canal `production`, que só chega em builds nativos que também
foram feitos com esse canal (todo build feito com `npm run mobile:build`/`mobile:build:submit` depois
desta configuração já é "OTA-ready").

**Atenção**: a compatibilidade do OTA é baseada no campo `version` do `app.json`
(`runtimeVersion: { policy: "appVersion" }`), não no `versionCode`. **Sempre que fizer uma mudança
nativa, suba esse `version`** (ex: `0.1.0` → `0.2.0`) antes do próximo build — esquecer disso pode fazer
o EAS tentar aplicar um OTA pensado pra um runtime novo em cima de um binário antigo incompatível.

## CD automático (GitHub Actions)

`.github/workflows/mobile-cd.yml` dispara sozinho quando um PR que mexeu em `apps/mobile/**` é
**mesclado** na `main` (nunca em push solto). Ele calcula o fingerprint do projeto, compara com o
último build de produção e decide sozinho entre publicar um OTA ou disparar um build+submit nativo —
atrás de um gate de aprovação manual (GitHub Environment `production`). Requer os secrets `EXPO_TOKEN`
e `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` configurados no repositório. Detalhes completos no `CLAUDE.md`.

## Testes e lint

```bash
npm run mobile:test         # jest
npm run mobile:lint         # eslint
npm run mobile:typecheck    # tsc --noEmit
```

## Arquitetura

Ver `CLAUDE.md` na raiz do monorepo — cobre estrutura de pastas, padrão de hooks/fetchers, tema,
histórico da migração de RN CLI pro Expo e as armadilhas conhecidas do build nativo no monorepo.
