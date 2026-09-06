/*
 * Superfície visual padrão dos campos de formulário.
 *
 * A referência é o `atoms/TextInput`, que já estava certo: 40px de altura, raio de 12px,
 * padding lateral de 16px e texto de 14px em NotoSans. O select e o gatilho de data nasceram
 * 4px mais baixos (h-9), com raio menor (rounded-md) e na fonte padrão do browser — a
 * `theme.fontFamily` do Tailwind não define a chave `sans`, então quem não marca
 * `font-noto-sans` explicitamente não herda a fonte da marca.
 *
 * As classes abaixo são equivalentes aos tokens usados pelo TextInput (h-10 = h-giant-xx = 40px,
 * px-4 = px-small-xx = 16px, text-sm = text-small = 14px), mas escritas na escala padrão do
 * Tailwind: o tailwind-merge não reconhece os tokens customizados como conflitantes e manteria
 * as duas alturas ao mesclar com as classes do Button.
 */

/* Só as métricas — pra controles que já têm a própria pele (ex.: Button com variant='outline'). */
export const FIELD_METRICS = 'h-10 rounded-lg px-4 text-sm font-medium font-noto-sans';

/* Métricas + pele (borda, fundo, sombra, foco e estado desabilitado). */
export const FIELD_SURFACE = `${ FIELD_METRICS } border border-input bg-background text-foreground shadow-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`;
