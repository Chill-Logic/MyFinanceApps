# @myfinance/web

Webapp do MyFinance, em Vite + React + TypeScript. Faz parte do monorepo `MyFinanceApps` — rode os
comandos a partir da raiz sempre que possível (aliases `webapp:*` no `package.json` da raiz).

## Setup

Instale as dependências a partir da **raiz do monorepo** (não rode `npm install` aqui dentro):

```bash
npm install
```

## Rodando o app

Da raiz do monorepo:

```bash
npm run webapp:dev          # vite dev server
npm run webapp:build        # tsc && vite build
npm run webapp:lint
npm run webapp:test         # jest
npm run webapp:storybook    # storybook dev, porta 6006
```

Ou, de dentro de `apps/web`, os mesmos comandos sem o prefixo `webapp:` (`npm run dev`, `npm run build`,
etc.).

## Stack

- **Vite + React + TypeScript**, roteamento com `react-router-dom` (rotas declaradas em
  `src/router/routes`, agrupadas por feature).
- **Tailwind CSS** + `@material-tailwind/react` pra estilização; design tokens em `src/util`
  (compartilha a paleta de marca com o mobile via `@myfinance/shared`).
- **TanStack Query** pra data-fetching (mesma versão fixada do mobile, `5.80.6`) — ao consumir a API,
  use os fetchers de `@myfinance/shared` em vez de bater no axios direto.
- **i18next/react-i18next** pra internacionalização.
- **Storybook** pros componentes de `src/components`.
- **`@casl/ability`** já está instalado mas ainda não integrado em nenhum componente.

Imports absolutos (`@/...`) são obrigatórios por lint fora da mesma pasta (alias `@` → `src`, ver
`vite.config.ts`).

## Arquitetura

Ver `CLAUDE.md` na raiz do monorepo — cobre estrutura de rotas, padrão de tipos (`@/types` reexporta
`@myfinance/shared` + tipos próprios de UI) e detalhes de configuração do TypeScript específicos deste
app.
