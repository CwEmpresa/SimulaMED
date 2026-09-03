/**
 * Verificação independente do resultado de scripts/import-questoes.ts.
 *
 * Confere o JSON gerado contra a planilha original e garante que o
 * rebalanceamento do gabarito trocou apenas POSIÇÕES, nunca conteúdo:
 *
 *   1. a alternativa correta nova tem exatamente o mesmo texto da correta antiga;
 *   2. o conjunto das 4 alternativas é idêntico (nada sumiu, nada foi inventado);
 *   3. enunciado, área, subtema e dificuldade seguem intocados;
 *   4. o comentário de erros cita exatamente as 3 alternativas erradas novas.
 *
 *   node --env-file=.env.local scripts/verificar-import.mjs
 */

import ExcelJS from 'exceljs'
import { readFileSync } from 'node:fs'

const RE_REFERENCIA = /(?<![A-Za-zÀ-ÿ])([A-D](?:\s*(?:,|\se\s)\s*[A-D])*)\s*:/g

const seed = JSON.parse(readFileSync('supabase/seed/simulado-01.json', 'utf8'))

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(process.env.PLANILHA_QUESTOES)
const ws = wb.getWorksheet('Simulados (300)')

const original = new Map()
ws.eachRow((row, n) => {
  if (n === 1) return
  const t = (c) => String(row.getCell(c).text ?? '').trim()
  if (!t(7)) return
  original.set(t(1), {
    alternativas: { A: t(8), B: t(9), C: t(10), D: t(11) },
    correta: t(12).toUpperCase(),
    enunciado: t(7),
    area: t(4),
    subtema: t(5),
    dificuldade: t(6),
  })
})

const falhas = []
for (const q of seed) {
  const o = original.get(q.id_planilha)
  if (!o) {
    falhas.push(`${q.id_planilha}: não existe na planilha`)
    continue
  }

  const textoCorretaNova = q[`alternativa_${q.resposta_correta.toLowerCase()}`]
  if (textoCorretaNova !== o.alternativas[o.correta]) {
    falhas.push(`${q.id_planilha}: a alternativa correta mudou de conteúdo`)
  }

  const antes = Object.values(o.alternativas).slice().sort().join('|')
  const depois = [q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d]
    .slice()
    .sort()
    .join('|')
  if (antes !== depois) falhas.push(`${q.id_planilha}: o conjunto de alternativas mudou`)

  if (q.enunciado !== o.enunciado) falhas.push(`${q.id_planilha}: enunciado alterado`)
  if (q.area !== o.area) falhas.push(`${q.id_planilha}: área alterada`)
  if ((q.subtema ?? '') !== o.subtema) falhas.push(`${q.id_planilha}: subtema alterado`)
  if ((q.dificuldade ?? '') !== o.dificuldade) falhas.push(`${q.id_planilha}: dificuldade alterada`)

  const citadas = [...(q.comentario_erros ?? '').matchAll(RE_REFERENCIA)]
    .flatMap((m) => [...m[1].matchAll(/[A-D]/g)].map((l) => l[0]))
  const esperadas = ['A', 'B', 'C', 'D'].filter((l) => l !== q.resposta_correta)
  const unicas = [...new Set(citadas)].sort()
  if (unicas.join(',') !== esperadas.join(',')) {
    falhas.push(
      `${q.id_planilha}: comentário cita [${unicas}] mas as erradas são [${esperadas}]`,
    )
  }
}

const conta = (chave) =>
  seed.reduce((acc, q) => ((acc[q[chave]] = (acc[q[chave]] ?? 0) + 1), acc), {})

console.log(`Questões verificadas: ${seed.length}`)
console.log('Gabarito final:', JSON.stringify(conta('resposta_correta')))
console.log('Áreas:', JSON.stringify(conta('area')))
console.log('')

if (falhas.length > 0) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  ${f}`))
  process.exit(1)
}
console.log('OK — nenhuma divergência. O rebalanceamento trocou apenas posições.')
