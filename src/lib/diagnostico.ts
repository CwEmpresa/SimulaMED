export type DesempenhoArea = { acertos: number; total: number; percentual: number }

export type AgregadoArea = {
  area: string
  acertos: number
  total: number
  percentual: number
  deSimulado: number
  doBanco: number
}

type TentativaFinalizada = {
  simulado_numero: number
  percentual_por_area: unknown
}

type RespostaBancoComArea = {
  correta: boolean | null
  questoes: { area: string } | { area: string }[] | null
}

/**
 * Soma o desempenho por área de simulados finalizados + banco respondido,
 * ordenado da área mais fraca para a mais forte.
 *
 * Compartilhado entre /diagnostico e /dashboard para as duas telas nunca
 * divergirem sobre qual é "a área mais fraca do aluno".
 *
 * Só a tentativa mais recente de cada simulado entra na soma: refazer um
 * simulado deve corrigir o retrato do aluno, não somar-se ao retrato antigo.
 */
export function calcularDesempenhoPorArea(
  tentativasFinalizadas: TentativaFinalizada[],
  respostasBanco: RespostaBancoComArea[],
): AgregadoArea[] {
  const maisRecentePorSimulado = new Map<number, TentativaFinalizada>()
  for (const t of tentativasFinalizadas) maisRecentePorSimulado.set(t.simulado_numero, t)

  const porArea = new Map<string, AgregadoArea>()
  const garantir = (area: string) => {
    if (!porArea.has(area)) {
      porArea.set(area, { area, acertos: 0, total: 0, percentual: 0, deSimulado: 0, doBanco: 0 })
    }
    return porArea.get(area)!
  }

  for (const t of maisRecentePorSimulado.values()) {
    const areas = (t.percentual_por_area ?? {}) as Record<string, DesempenhoArea>
    for (const [area, d] of Object.entries(areas)) {
      const ag = garantir(area)
      ag.acertos += d.acertos
      ag.total += d.total
      ag.deSimulado += d.total
    }
  }

  for (const r of respostasBanco) {
    const area = Array.isArray(r.questoes) ? r.questoes[0]?.area : r.questoes?.area
    if (!area) continue
    const ag = garantir(area)
    ag.total += 1
    ag.doBanco += 1
    if (r.correta) ag.acertos += 1
  }

  return [...porArea.values()]
    .map((a) => ({ ...a, percentual: a.total ? Math.round((100 * a.acertos) / a.total) : 0 }))
    .sort((a, b) => a.percentual - b.percentual)
}

/**
 * Há área mais fraca a destacar? Exige desempenho abaixo do bom E alguma
 * diferença entre a pior e a melhor — senão o "destaque" é só a ordem da lista.
 */
export function temAreaDestacada(agregados: AgregadoArea[]) {
  if (agregados.length < 2) return false
  const pior = agregados[0].percentual
  const melhor = agregados[agregados.length - 1].percentual
  return pior < 70 && pior < melhor
}
