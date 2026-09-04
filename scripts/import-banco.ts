/**
 * Importa as questões do Banco (tipo = 'banco') para a tabela `questoes`.
 *
 *   npm run import:banco -- --dry-run    # valida tudo e gera artefatos, não escreve
 *   npm run import:banco                 # valida, gera artefatos e faz upsert
 *
 * Diferença em relação ao `import-questoes.ts` (simulados):
 *
 * O importador dos simulados REBALANCEIA o gabarito, porque a planilha de
 * produção saiu com a correta em A em 291 das 300 questões. Aqui o conteúdo é
 * escrito já com a correta distribuída, então rebalancear seria pior: mudaria a
 * letra a cada importação conforme o acervo cresce, e o JSON versionado deixaria
 * de refletir o que está no banco. Em vez disso este script **verifica** o
 * equilíbrio e recusa a importação se alguma letra sair da faixa 20%–30% — a
 * mesma brecha ("marcar sempre a mesma letra") fechada por outro caminho.
 *
 * Como o `id_planilha` é único, o upsert é idempotente: reimportar corrige o
 * conteúdo de quem já existe em vez de duplicar.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { LETRAS, contar, formatar, letrasCitadas, type Letra } from './lib/gabarito'

config({ path: resolve(process.cwd(), '.env.local') })

const ORIGEM = resolve('supabase/seed/banco')
const DESTINO = resolve('supabase/seed')

/** As cinco áreas da aba "Áreas e Metas". Área fora desta lista quebraria o filtro da tela. */
const AREAS = [
  'Clínica Médica',
  'Ginecologia e Obstetrícia',
  'Cirurgia',
  'Pediatria',
  'Medicina Preventiva e Social',
] as const

const DIFICULDADES = ['Fácil', 'Médio', 'Difícil'] as const

/** Abaixo disto o equilíbrio do gabarito não é estatisticamente significativo (lote de teste). */
const MINIMO_PARA_CHECAR_EQUILIBRIO = 40
const FAIXA_ACEITAVEL = { min: 0.2, max: 0.3 }

type TabelaDados = { colunas: string[]; linhas: string[][] }
type ImagemApoio = { url: string; legenda?: string }

type QuestaoBanco = {
  id_planilha: string
  area: string
  subtema: string
  dificuldade?: string
  ano_origem?: number | null
  fonte?: string | null
  enunciado: string
  alternativa_a: string
  alternativa_b: string
  alternativa_c: string
  alternativa_d: string
  resposta_correta: Letra
  comentario_correta: string
  comentario_erros: string
  status?: string
  tabela_dados?: TabelaDados | null
  grafico_svg?: string | null
  imagens?: ImagemApoio[] | null
}

const erros: string[] = []
function exigir(condicao: boolean, mensagem: string) {
  if (!condicao) erros.push(mensagem)
}

function textoNaoVazio(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Mesma regra do importador dos simulados: {colunas, linhas} como ARRAYS.
 * Objeto por linha perderia a ordem das colunas — o Postgres reordena as chaves
 * de um objeto jsonb por tamanho e depois lexicograficamente.
 */
function validarTabelaDados(t: unknown, id: string) {
  if (t === undefined || t === null) return
  const tab = t as Partial<TabelaDados>
  const colunasOk = Array.isArray(tab.colunas) && tab.colunas.every((c) => typeof c === 'string')
  const linhasOk =
    Array.isArray(tab.linhas) &&
    tab.linhas.every(
      (l) => Array.isArray(l) && l.length === tab.colunas!.length && l.every((v) => typeof v === 'string'),
    )
  exigir(
    colunasOk && linhasOk,
    `${id}: tabela_dados deve ser {colunas: string[], linhas: string[][]} com todas as linhas do tamanho de colunas`,
  )
}

/** Traçado esquemático (ECG, espirometria) — padrão fisiológico, não foto de paciente. */
function validarGraficoSvg(g: unknown, id: string) {
  if (g === undefined || g === null) return
  exigir(textoNaoVazio(g) && g.includes('<svg'), `${id}: grafico_svg não contém uma tag <svg>`)
}

/**
 * Nunca gerada por IA: uma foto "quase certa" de lesão de pele ou radiografia
 * ensinaria errado exatamente o reconhecimento visual que a questão testa.
 * Toda url precisa vir de acervo real e licenciado.
 */
function validarImagens(imgs: unknown, id: string) {
  if (imgs === undefined || imgs === null) return
  if (!Array.isArray(imgs) || imgs.length === 0) {
    erros.push(`${id}: imagens deve ser uma lista não vazia de {url, legenda?}`)
    return
  }
  imgs.forEach((item, i) => {
    exigir(textoNaoVazio((item as ImagemApoio)?.url), `${id}: imagens[${i}] precisa de "url"`)
    const legenda = (item as ImagemApoio)?.legenda
    exigir(
      legenda === undefined || typeof legenda === 'string',
      `${id}: imagens[${i}].legenda deve ser string`,
    )
  })
}

function validar(q: QuestaoBanco, arquivo: string, vistos: Set<string>) {
  const id = q.id_planilha ?? '(sem id)'
  const onde = `${arquivo} → ${id}`

  exigir(/^BANCO-\d{3}$/.test(q.id_planilha ?? ''), `${onde}: id_planilha deve ser BANCO-000`)
  exigir(!vistos.has(q.id_planilha), `${onde}: id_planilha repetido`)
  vistos.add(q.id_planilha)

  exigir((AREAS as readonly string[]).includes(q.area), `${onde}: área "${q.area}" fora da lista`)
  exigir(textoNaoVazio(q.subtema), `${onde}: subtema é obrigatório (alimenta o filtro)`)
  exigir(
    q.dificuldade === undefined || (DIFICULDADES as readonly string[]).includes(q.dificuldade),
    `${onde}: dificuldade deve ser Fácil, Médio ou Difícil`,
  )
  exigir(
    q.ano_origem === undefined ||
      q.ano_origem === null ||
      (Number.isInteger(q.ano_origem) && q.ano_origem >= 2010 && q.ano_origem <= 2026),
    `${onde}: ano_origem fora da faixa 2010–2026`,
  )

  exigir(textoNaoVazio(q.enunciado), `${onde}: enunciado vazio`)

  const alternativas = [q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d]
  exigir(alternativas.every(textoNaoVazio), `${onde}: há alternativa vazia`)
  exigir(
    new Set(alternativas.map((a) => (a ?? '').trim())).size === 4,
    `${onde}: há alternativas repetidas`,
  )

  exigir(
    (LETRAS as readonly string[]).includes(q.resposta_correta),
    `${onde}: resposta_correta "${q.resposta_correta}" inválida`,
  )
  exigir(textoNaoVazio(q.comentario_correta), `${onde}: comentario_correta vazio`)
  exigir(textoNaoVazio(q.comentario_erros), `${onde}: comentario_erros vazio`)

  // A checagem que mais pega erro humano em lote: o comentário precisa explicar
  // exatamente as três alternativas erradas — nem a correta, nem uma letra a menos.
  if (textoNaoVazio(q.comentario_erros) && (LETRAS as readonly string[]).includes(q.resposta_correta)) {
    const citadas = letrasCitadas(q.comentario_erros)
    const esperadas = LETRAS.filter((l) => l !== q.resposta_correta).sort()
    exigir(
      JSON.stringify(citadas) === JSON.stringify(esperadas),
      `${onde}: comentario_erros cita [${citadas}] mas as erradas são [${esperadas}]`,
    )
  }

  validarTabelaDados(q.tabela_dados, onde)
  validarGraficoSvg(q.grafico_svg, onde)
  validarImagens(q.imagens, onde)
}

function lerArquivos() {
  let nomes: string[]
  try {
    nomes = readdirSync(ORIGEM).filter((n) => n.endsWith('.json')).sort()
  } catch {
    throw new Error(`Pasta não encontrada: ${ORIGEM}`)
  }
  if (nomes.length === 0) throw new Error(`Nenhum .json em ${ORIGEM}`)

  const vistos = new Set<string>()
  const todas: QuestaoBanco[] = []

  for (const nome of nomes) {
    let json: unknown
    try {
      json = JSON.parse(readFileSync(resolve(ORIGEM, nome), 'utf8'))
    } catch (e) {
      throw new Error(`${nome}: JSON inválido (${(e as Error).message})`)
    }
    if (!Array.isArray(json)) throw new Error(`${nome}: o arquivo deve conter uma lista de questões`)

    for (const q of json as QuestaoBanco[]) {
      validar(q, nome, vistos)
      todas.push(q)
    }
    console.log(`  ${nome}: ${json.length} questões`)
  }

  return todas
}

function conferirEquilibrio(questoes: QuestaoBanco[]) {
  const distribuicao = contar(questoes.map((q) => q.resposta_correta))
  console.log(`Gabarito: ${formatar(distribuicao)}`)

  if (questoes.length < MINIMO_PARA_CHECAR_EQUILIBRIO) {
    console.log(
      `  (menos de ${MINIMO_PARA_CHECAR_EQUILIBRIO} questões — equilíbrio não verificado)`,
    )
    return
  }

  for (const letra of LETRAS) {
    const fracao = (distribuicao[letra] ?? 0) / questoes.length
    if (fracao < FAIXA_ACEITAVEL.min || fracao > FAIXA_ACEITAVEL.max) {
      erros.push(
        `Gabarito desequilibrado: ${letra} em ${(fracao * 100).toFixed(1)}% das questões ` +
          `(aceitável: ${FAIXA_ACEITAVEL.min * 100}%–${FAIXA_ACEITAVEL.max * 100}%)`,
      )
    }
  }
}

function relatarPorArea(questoes: QuestaoBanco[]) {
  console.log('Distribuição por área:')
  for (const area of AREAS) {
    const daArea = questoes.filter((q) => q.area === area)
    if (daArea.length === 0) continue
    console.log(
      `  ${area.padEnd(30)} ${String(daArea.length).padStart(3)}  ` +
        `(${formatar(contar(daArea.map((q) => q.resposta_correta)))})`,
    )
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`Lendo ${ORIGEM}`)
  const questoes = lerArquivos()
  console.log(`Total: ${questoes.length} questões.`)

  conferirEquilibrio(questoes)
  relatarPorArea(questoes)

  if (erros.length > 0) {
    console.error(`\n${erros.length} problema(s) encontrado(s):`)
    for (const e of erros) console.error(`  • ${e}`)
    throw new Error('Importação abortada: corrija os problemas acima.')
  }

  const registros = questoes.map((q) => ({
    id_planilha: q.id_planilha,
    tipo: 'banco' as const,
    // O CHECK `questao_simulado_coerente` exige os dois nulos quando tipo='banco'.
    simulado_numero: null,
    numero_na_prova: null,
    area: q.area,
    subtema: q.subtema,
    dificuldade: q.dificuldade ?? null,
    ano_origem: q.ano_origem ?? null,
    fonte: q.fonte ?? null,
    enunciado: q.enunciado,
    alternativa_a: q.alternativa_a,
    alternativa_b: q.alternativa_b,
    alternativa_c: q.alternativa_c,
    alternativa_d: q.alternativa_d,
    resposta_correta: q.resposta_correta,
    comentario_correta: q.comentario_correta,
    comentario_erros: q.comentario_erros,
    status: q.status ?? 'Em revisão',
    tabela_dados: q.tabela_dados ?? null,
    grafico_svg: q.grafico_svg ?? null,
    imagens: q.imagens ?? null,
  }))

  mkdirSync(DESTINO, { recursive: true })
  writeFileSync(`${DESTINO}/banco.json`, JSON.stringify(registros, null, 2), 'utf8')
  console.log(`\nArtefato escrito em ${DESTINO}/banco.json`)

  if (dryRun) {
    console.log('--dry-run: banco não foi tocado.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n' +
        'Rode com --dry-run para apenas validar.',
    )
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error, count } = await supabase
    .from('questoes')
    .upsert(registros, { onConflict: 'id_planilha', count: 'exact' })
  if (error) throw error

  console.log(`Upsert concluído: ${count ?? registros.length} questões de banco.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
