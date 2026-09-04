/**
 * Peças compartilhadas pelos dois importadores (`import-questoes.ts` para os
 * simulados, `import-banco.ts` para o banco avulso).
 *
 * A regex de referência de alternativa mora aqui, e não duplicada nos dois
 * scripts, porque ela é sutil: precisa casar "A:", "C e D:" e "B, C:" sem casar
 * "Plano A:" nem "39°C)". Duas cópias divergiriam na primeira vez que alguém
 * ajustasse uma delas.
 */

export const LETRAS = ['A', 'B', 'C', 'D'] as const
export type Letra = (typeof LETRAS)[number]

/**
 * Casa o rótulo de um trecho de comentário de erros: uma ou mais letras A-D
 * separadas por vírgula ou " e ", seguidas de dois-pontos. O lookbehind evita
 * casar a letra final de uma palavra ("Plano A:" não é referência a alternativa).
 */
export const RE_REFERENCIA = /(?<![A-Za-zÀ-ÿ])([A-D](?:\s*(?:,|\se\s)\s*[A-D])*)\s*:/g

/** Letras de alternativa citadas num comentário de erros, sem repetição e ordenadas. */
export function letrasCitadas(texto: string): Letra[] {
  const citadas = [...texto.matchAll(RE_REFERENCIA)].flatMap((m) =>
    [...m[1].matchAll(/[A-D]/g)].map((l) => l[0] as Letra),
  )
  return [...new Set(citadas)].sort()
}

export function contar(letras: string[]) {
  return letras.reduce<Record<string, number>>((acc, l) => ((acc[l] = (acc[l] ?? 0) + 1), acc), {})
}

export function formatar(c: Record<string, number>) {
  return LETRAS.map((l) => `${l}=${c[l] ?? 0}`).join('  ')
}
