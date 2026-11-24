# MyFinance — app (web + Android)

O app do MyFinance, de organização e planejamento financeiro: Vite + React + TypeScript no navegador
(`myfinance.app.br`, na Vercel) e, empacotado no **Capacitor 8**, o app Android da Google Play. O backend é o
`my-finance-api` (Rails), em outro repositório.

## Estrutura

```
src/            o app (páginas, componentes, hooks, contextos)
src/shared/     contrato com a API: tipos de domínio, rotas, fetchers, chaves de cache, utils puros e tokens
                da marca — importado como `@myfinance/shared`
public/         arquivos servidos como estão (app-version.json, og-image.png, brand/)
android/        projeto Android do Capacitor (versionado)
assets/         ícones de origem e as imagens da Play Store (assets/play-store)
```

`src/shared` concentra tudo o que descreve o backend e não depende de tela. Ao mudar um contrato, um fetcher,
uma query key ou um formatter, mude ali — não redefina no app.

## Comandos

```bash
npm install
npm run dev              # servidor de desenvolvimento (Vite)
npm run build            # tsc + vite build
npm run lint
npm run storybook        # porta 6006
npm run cap:sync         # build + cap sync android (Node >= 22)
npm run android          # sync + abre o Android Studio
npm run android:bundle   # sync + AAB de release assinado
```

Não há testes automatizados: a validação é `tsc` + lint + build.

## Ambiente

Copie `.env.example` pra `.env` e preencha `VITE_API_URL` e `VITE_API_KEY` (sem eles o app abre mas não fala com
a API). `VITE_WEB_URL` (de onde o app lê o `app-version.json`) e `VITE_GOOGLE_CLIENT_ID` (login com o Google)
são opcionais.

## Android

- Assinatura de release: `android/keystore.properties` (fora do git; modelo em `keystore.properties.example`),
  apontando pra upload key (`android/app/release.p12`, também fora do git).
- O Gradle precisa saber onde está o Android SDK: `ANDROID_HOME` no Windows ou `android/local.properties` com
  `sdk.dir=...` (o Android Studio cria sozinho ao abrir o projeto).
- CD: `.github/workflows/android-cd.yml` publica na faixa de teste interno da Play a cada PR mesclado na `main`
  que mexe no app.

## Convenções

- Documentação e mensagens de commit em português.
- Endereços (rotas, parâmetros) em português; pastas, componentes e identificadores em inglês.
- Imports absolutos `@/...` fora da mesma pasta (o lint cobra). Dentro de `src/shared`, imports relativos.

Detalhes de arquitetura, decisões e armadilhas conhecidas estão no `CLAUDE.md`.
