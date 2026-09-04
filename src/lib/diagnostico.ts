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
 * Resultado da análise de "área mais fraca":
 *
 * - `sem_dados`: nada foi respondido em lugar nenhum ainda (nem simulado nem banco).
 * - `tudo_bem`: nenhuma área está mal o bastante (≥70%) — não há nada a
 *   destacar, e não é um problema: não mostrar mensagem nenhuma aqui.
 * - `empatado`: todas as áreas têm o mesmo percentual, e ele é ruim (<70%).
 *   O caso mais comum disso é ninguém ter respondido nada (tudo em 0%). Sem
 *   diferença entre elas, eleger uma como "a mais fraca" seria arbitrário.
 * - `ok`: existe uma diferença real. `areas` traz TODAS as que empatam no
 *   pior percentual — pode ser uma só, ou várias.
 *
 * Bug corrigido aqui: antes, com 2+ áreas empatadas no fundo da lista mas
 * ALGUMA área diferente das demais (então não caía no caso `empatado`), o
 * código pegava `agregados[0]` cegamente — ou seja, escolhia uma das
 * empatadas por ordem de array, não por ser de fato "a" mais fraca.
 */
export type AnaliseAreaFraca =
  | { tipo: 'sem_dados' }
  | { tipo: 'tudo_bem' }
  | { tipo: 'empatado' }
  | { tipo: 'ok'; areas: string[]; percentual: number }

/**
 * Só precisa de área + percentual — aceita tanto AgregadoArea[] quanto os
 * pares [área, {percentual}] de um único simulado (Object.entries).
 *
 * Ordena por conta própria em vez de confiar que o chamador já mandou
 * ordenado: esta função existe para não deixar a posição num array decidir
 * qual área é "a mais fraca" por acidente — seria irônico ela mesma ficar
 * frágil a exatamente isso caso um chamador futuro esqueça de ordenar antes.
 */
export function analisarAreaMaisFraca(
  agregadosEmQualquerOrdem: { area: string; percentual: number }[],
): AnaliseAreaFraca {
  if (agregadosEmQualquerOrdem.length === 0) return { tipo: 'sem_dados' }

  const agregados = [...agregadosEmQualquerOrdem].sort((x, y) => x.percentual - y.percentual)

  const pior = agregados[0].percentual
  const melhor = agregados[agregados.length - 1].percentual

  if (pior >= 70) return { tipo: 'tudo_bem' }
  if (pior === melhor) return { tipo: 'empatado' } // todas iguais e ruins — sem "mais fraca"

  const areas = agregados.filter((a) => a.percentual === pior).map((a) => a.area)
  return { tipo: 'ok', areas, percentual: pior }
}

/** "Cirurgia" / "Cirurgia e Pediatria" / "Cirurgia, Pediatria e Clínica Médica". */
export function formatarListaDeAreas(areas: string[]): string {
  if (areas.length === 1) return areas[0]
  if (areas.length === 2) return `${areas[0]} e ${areas[1]}`
  return `${areas.slice(0, -1).join(', ')} e ${areas[areas.length - 1]}`
}
