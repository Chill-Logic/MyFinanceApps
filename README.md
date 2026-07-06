# MyFinanceApps

Monorepo com o app mobile e o webapp do MyFinance, compartilhando tipos, contratos de API, rotas e
lógica de formatação do mesmo backend.

## Estrutura

```
MyFinanceApps/
├── apps/
│   ├── mobile/   # React Native + Expo (SDK 57) — ver apps/mobile/README.md
│   └── web/      # Vite + React — ver apps/web/README.md
└── packages/
    └── shared/   # @myfinance/shared — models, contratos de API, rotas, formatters e design tokens
```

- **apps/mobile**: app React Native, migrado pro Expo (SDK 57, Continuous Native Generation). Histórico
  importado de `my-finance-app`.
- **apps/web**: aplicação web em Vite/React. Histórico importado de `my-finance-webapp`.
- **packages/shared**: pacote `@myfinance/shared`, consumido pelos dois apps via workspace (dependência
  `"*"` no `package.json`, sem etapa de build — Metro e Vite consomem o TypeScript fonte diretamente).
  Contém:
  - `models.ts` — entidades do domínio (`TUser`, `TTransaction`, `TWallet`, `TInvite`)
  - `api.ts` — contratos de request/response da API (`TMutationParams`)
  - `routes.ts` — endpoints do backend (`API_ROUTES`)
  - `queryKeys.ts` — chaves de cache do React Query (`QUERY_KEYS`)
  - `fetchers/` — funções puras `(axios, params?) => Promise<T>`, uma por operação, usadas pelos hooks
    dos dois apps
  - `utils/` — formatação de data/dinheiro/texto (`DateUtils`, `MoneyUtils`, `TextUtils`)
  - `tokens.ts` — design tokens da marca (`colors`, `spacing`, `borderRadius`, `fontSize`, `fontWeight`,
    `Theme.light`/`Theme.dark`)

Qualquer tipo, rota, fetcher, formatter ou token de design deve ser adicionado/alterado em
`packages/shared`, nunca duplicado em cada app.

## Convenções

- Documentação (READMEs, `CLAUDE.md`) e mensagens de commit em português.
- npm workspaces puro — sem pnpm/yarn, sem Turborepo.
- Nunca importar libs de terceiro (ex: `date-fns`) diretamente nos apps — sempre pelos helpers de
  `packages/shared`.

## Requisitos

- Node.js >= 22.11 (exigido pelo `apps/mobile`, alinhado ao Expo SDK 57)
- npm (workspaces nativos)
- Pra rodar o mobile no Android: Android Studio/SDK instalado, com `ANDROID_HOME` configurado ou
  `android/local.properties` criado (ver `apps/mobile/README.md`)
- Pra rodar o mobile no iOS: só é possível num Mac (CocoaPods + Xcode)

## Instalação

Instale as dependências de todos os workspaces a partir da raiz:

```bash
npm install
```

## Rodando cada app

A raiz do monorepo tem aliases prontos pra cada app, pra não precisar lembrar da flag `--workspace`:

```bash
# mobile
npm run mobile:start        # expo start --clear
npm run mobile:android      # expo run:android — builda nativo, instala e abre
npm run mobile:ios
npm run mobile:lint
npm run mobile:test
npm run mobile:typecheck

# web
npm run webapp:dev
npm run webapp:build
npm run webapp:lint
npm run webapp:test
npm run webapp:storybook
```

Não existe script de build/lint/test genérico na raiz que rode os dois apps de uma vez — use sempre um
dos aliases acima, ou entre em `apps/mobile` / `apps/web` e rode o script diretamente.

Detalhes específicos de cada app (variáveis de ambiente, build nativo, assinatura de release, etc.)
estão nos READMEs de `apps/mobile` e `apps/web`. Detalhes de arquitetura mais profundos (pra quem vai
mexer no código, não só rodar) estão no `CLAUDE.md` na raiz.
