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

O template gerado pelo `expo prebuild` não vem com `signingConfigs.release` configurado — builds de
release usam a assinatura de debug por padrão. A keystore de produção
(`android/app/my-release-key.keystore` + `android/app/release.properties`, ambos gitignored) existe no
projeto, mas o bloco de signing config no `build.gradle` precisa ser readicionado manualmente toda vez
que o `prebuild` regenerar esse arquivo do zero (não sobrevive ao CNG sozinho).

O caminho recomendado daqui pra frente é **EAS Build** (builda na nuvem, guarda a keystore de forma
gerenciada, e destrava build de iOS sem precisar de Mac) — ainda não configurado neste repo
(`eas.json` não existe). Antes de configurar, confirme na Play Console
(**Configuração do app → Integridade do app → Assinatura do app**) que o fingerprint da keystore local
bate com o que já assina o app publicado.

## Testes e lint

```bash
npm run mobile:test         # jest
npm run mobile:lint         # eslint
npm run mobile:typecheck    # tsc --noEmit
```

## Arquitetura

Ver `CLAUDE.md` na raiz do monorepo — cobre estrutura de pastas, padrão de hooks/fetchers, tema,
histórico da migração de RN CLI pro Expo e as armadilhas conhecidas do build nativo no monorepo.
