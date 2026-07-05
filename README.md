# MyFinance

Monorepo com o app mobile e o webapp do MyFinance, compartilhando tipos, contratos de API e rotas do mesmo backend.

## Estrutura

```
MyFinance/
├── apps/
│   ├── mobile/   # React Native (CLI puro, sem Expo) — ver apps/mobile/README.md
│   └── web/      # Vite + React — ver apps/web/README.md
└── packages/
    └── shared/   # @myfinance/shared — models, contratos de API e rotas do backend
```

- **apps/mobile**: app React Native. Histórico importado de `my-finance-app`.
- **apps/web**: aplicação web em Vite/React. Histórico importado de `my-finance-webapp`.
- **packages/shared**: pacote `@myfinance/shared`, consumido pelos dois apps via workspace (dependência `"*"` no `package.json`). Contém:
  - `models.ts` — entidades do domínio (`TUser`, `TTransaction`, `TWallet`, `TInvite`)
  - `api.ts` — contratos de request/response da API
  - `routes.ts` — endpoints do backend (`API_ROUTES`)

Qualquer tipo ou rota de API deve ser adicionado/alterado em `packages/shared`, não duplicado em cada app.

## Requisitos

- Node.js >= 18
- npm (workspaces nativos, sem pnpm/yarn)

## Instalação

Instale as dependências de todos os workspaces a partir da raiz:

```bash
npm install
```

## Rodando cada app

A raiz do monorepo tem aliases prontos pra cada app, pra não precisar lembrar da flag `--workspace`:

```bash
# mobile
npm run mobile:start
npm run mobile:android
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

Detalhes específicos de cada app (variáveis de ambiente, build nativo, etc.) estão nos READMEs de `apps/mobile` e `apps/web`.
