/*
 * Superfície visual padrão dos campos de formulário (input, select, gatilho de data, TextInput).
 *
 * Redesign 2026-11: 44px de altura (alvo de toque confortável também no celular), raio de 16px
 * (`rounded-lg` = `--radius`), fundo no tom de campo do tema (`bg-secondary`) e foco com anel oliva
 * suave em vez da borda grossa. Fonte vem do `body` (Geist) — não marque família aqui.
 *
 * As classes estão na escala padrão do Tailwind de propósito: o tailwind-merge não reconhece os
 * tokens customizados (h-giant-xx etc.) como conflitantes e manteria duas alturas ao mesclar com as
 * classes do Button.
 */

/* Só as métricas — pra controles que já têm a própria pele (ex.: Button com variant='outline'). */
export const FIELD_METRICS = 'h-11 rounded-lg px-4 text-sm font-medium';

/* Métricas + pele (borda, fundo, foco e estado desabilitado). */
export const FIELD_SURFACE = `${ FIELD_METRICS } border border-input bg-secondary text-foreground transition-[border-color,box-shadow] outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50`;
