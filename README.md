# MyFinanceApps

O app do MyFinance: um app web em Vite + React que roda no navegador (Vercel) e, empacotado no Capacitor,
é o app Android da Play Store. Monorepo com o app e o pacote compartilhado de contrato com o backend.

## Estrutura

```
MyFinanceApps/
├── apps/
│   └── web/      # Vite + React + Capacitor (Android) — ver apps/web/README.md
└── packages/
    └── shared/   # @myfinance/shared — models, contratos de API, rotas, formatters e design tokens
```

- **apps/web**: o app. No navegador e no Android (pasta `apps/web/android`, versionada). Histórico importado
  de `my-finance-webapp`.
- **packages/shared**: pacote `@myfinance/shared`, consumido via workspace (dependência `"*"` no
  `package.json`, sem etapa de build — o Vite consome o TypeScript fonte diretamente). Contém:
  - `models.ts` — entidades do domínio (`TUser`, `TTransaction`, `TWallet`, `TInvite`...)
  - `api.ts` — contratos de request/response da API (`TMutationParams`)
  - `routes.ts` — endpoints do backend (`API_ROUTES`)
  - `queryKeys.ts` — chaves de cache do React Query (`QUERY_KEYS`)
  - `fetchers/` — funções puras `(axios, params?) => Promise<T>`, uma por operação, usadas pelos hooks
  - `utils/` — formatação e regras puras (`DateUtils`, `MoneyUtils`, `TransactionUtils`, `InvoiceUtils`...)
  - `tokens.ts` — design tokens da marca

Até 2026-11 existia também um app em React Native (`apps/mobile`); ele foi substituído pelo web no Capacitor e
apagado.

Qualquer tipo, rota, fetcher, formatter ou token de design deve ser adicionado/alterado em
`packages/shared`, não no app.

## Convenções

- Documentação (READMEs, `CLAUDE.md`) e mensagens de commit em português.
- npm workspaces puro — sem pnpm/yarn, sem Turborepo.
- Nunca importar libs de terceiro (ex: `date-fns`) diretamente no app quando houver helper em
  `packages/shared`.

## Requisitos

- Node.js >= 22 (o Capacitor 8 exige; o dev do web roda também no 20)
- npm (workspaces nativos)
- Pra gerar o app Android: Android Studio/SDK, com `ANDROID_HOME` configurado ou
  `apps/web/android/local.properties` criado

## Instalação

Instale as dependências a partir da raiz:

```bash
npm install
```

## Rodando

A raiz tem aliases prontos, pra não precisar lembrar da flag `--workspace`:

```bash
npm run webapp:dev            # servidor de dev do Vite
npm run webapp:build          # tsc + vite build
npm run webapp:lint
npm run webapp:storybook
npm run webapp:cap:sync       # build + cap sync android
npm run webapp:android        # sync + abre o Android Studio
npm run webapp:android:bundle # sync + AAB de release assinado
```

Variáveis de ambiente, assinatura de release e o CD do Android estão no `apps/web/README.md` e no
`CLAUDE.md` da raiz, que também tem os detalhes de arquitetura.
