# Imagens da Play Store

O que vai na página do MyFinance na Google Play (Play Console → Presença na loja → Página principal da loja).

| Arquivo | O que é | Tamanho |
|---|---|---|
| `play-icon-512.png` | Ícone da loja: o losango sobre o mesmo cinza do ícone do app instalado (`#C5C4BF`), sem transparência | 512×512 |
| `feature-graphic.png` | Gráfico de recursos: logo, nome e "Organize hoje. Planeje o mês que vem." | 1024×500 |
| `screenshots/1-inicio.png` … `6-carteiras.png` | Prints do celular, tema escuro, com a conta de demonstração | 1080×1920 |

Os prints usam **dados inventados** (nunca de uma conta real — a página da loja é pública).

## Conta de demonstração

`seed_demo.py` cria e popula a conta de demonstração (Marina Alves, carteira "Casa" compartilhada com Lucas Alves,
carteira "Viagem 2027", contas, cartões, transações, recorrências e parcelas). A senha vem de `DEMO_PASSWORD` e não
fica no repositório.

```bash
# API local (Docker):
DEMO_PASSWORD=... python seed_demo.py http://localhost:3010/v1 <X-API-Key local>

# Popular uma conta que já existe (ex.: a do revisor da Play), em vez de criar a Marina:
MAIN_TOKEN=<token da conta> LUCAS_EMAIL=<e-mail do 2º membro> DEMO_PASSWORD=... python seed_demo.py <URL da API>/v1 <X-API-Key>
```

As datas são fixas (novembro de 2026). Rodando em outro mês, ajuste as datas antes, senão o que aparece como
"pendente" e "próxima ocorrência" fica no passado.

A conta do **revisor da Play** em produção (informada em Play Console → Conteúdo do app → Acesso ao app) já foi
populada assim, em 2026-11-24.

## Refazer os prints

Com o app rodando (`npm run dev`, em `http://localhost:5173`), a API local em `:3010` e a conta de
demonstração criada:

```bash
DEMO_PASSWORD=... node screenshots.mjs ./screenshots          # todos (Node 22+, usa o Chrome instalado)
DEMO_PASSWORD=... node screenshots.mjs ./screenshots 3-cartoes # só um
```

O script abre o Chrome em modo headless no tamanho de um celular (360×640 a 3x), entra com a conta de demonstração
em tema escuro e espera os dados carregarem antes de cada print. O ícone e o gráfico de recursos foram desenhados à
parte, a partir de `src/assets/brand/icon.svg` e `wordmark-on-dark.svg`.
