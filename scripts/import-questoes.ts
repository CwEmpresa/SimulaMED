/**
 * Importa as questões da planilha de produção para a tabela `questoes` do Supabase.
 *
 *   npm run import:questoes -- --dry-run    # gera artefatos, não escreve no banco
 *   npm run import:questoes                 # gera artefatos e faz upsert no banco
 *
 * Por que existe o rebalanceamento de gabarito:
 * o Simulado 1 saiu da produção com a alternativa correta em A em 69 das 100 questões
 * (A=69, B=30, C=1, D=0). Um aluno que marcasse "A" em tudo tiraria 69/100 sem ler nada,
 * o que destrói o valor de treino do simulado. Este script redistribui a POSIÇÃO da
 * alternativa correta para ~25% em cada letra, de forma determinística (seed fixa), e
 * reescreve as letras citadas no comentário de erros para continuarem apontando para as
 * alternativas certas. A planilha original nunca é modificada.
 */

import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { config } from 'dotenv'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// O Next lê .env.local sozinho; um script avulso precisa apontar o caminho.
config({ path: resolve(process.cwd(), '.env.local') })

const ABA = 'Simulados (300)'
const SEED = 20260902 // trocar a seed muda todo o embaralhamento — mantenha fixa
const LETRAS = ['A', 'B', 'C', 'D'] as const
type Letra = (typeof LETRAS)[number]

type QuestaoPlanilha = {
  idPlanilha: string
  simulado: number
  numeroNaProva: number
  area: string
  subtema: string
  dificuldade: string
  enunciado: string
  alternativas: Record<Letra, string>
  correta: Letra
  comentarioCorreta: string
  comentarioErros: string
  status: string
  tabelaDadosTexto: string
  graficoSvg: string
  imagensTexto: string
}

type TabelaDados = { colunas: string[]; linhas: string[][] }
type ImagemApoio = { url: string; legenda?: string }

/**
 * `tabela_dados` guarda {colunas, linhas} como ARRAYS, nunca uma lista de
 * objetos {coluna: valor} por linha — o Postgres reordena chaves de objeto em
 * jsonb (por tamanho, depois lexicograficamente), o que embaralharia a ordem
 * das colunas silenciosamente. Só array preserva ordem de inserção.
 */
function lerTabelaDados(texto: string, idPlanilha: string): TabelaDados | null {
  if (!texto) return null
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch (e) {
    throw new Error(`${idPlanilha}: coluna "Tabela" não é JSON válido (${(e as Error).message})`)
  }
  const t = json as Partial<TabelaDados> | null
  const colunasOk = !!t && Array.isArray(t.colunas) && t.colunas.every((c) => typeof c === 'string')
  const linhasOk =
    !!t &&
    Array.isArray(t.linhas) &&
    t.linhas.every(
      (l) => Array.isArray(l) && l.length === t.colunas!.length && l.every((v) => typeof v === 'string'),
    )
  if (!colunasOk || !linhasOk) {
    throw new Error(
      `${idPlanilha}: coluna "Tabela" deve ser {colunas: string[], linhas: string[][]}, todas as linhas com o mesmo tamanho de colunas`,
    )
  }
  return t as TabelaDados
}

/** Representação de padrão fisiológico (ECG, espirometria) — não é foto de paciente real. */
function lerGraficoSvg(texto: string, idPlanilha: string): string | null {
  if (!texto) return null
  if (!texto.includes('<svg')) {
    throw new Error(`${idPlanilha}: coluna "Gráfico SVG" não contém uma tag <svg>`)
  }
  return texto
}

/** Nunca gerada por IA — cada url precisa vir de fonte real e licenciada. */
function lerImagens(texto: string, idPlanilha: string): ImagemApoio[] | null {
  if (!texto) return null
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch (e) {
    throw new Error(`${idPlanilha}: coluna "Imagens" não é JSON válido (${(e as Error).message})`)
  }
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`${idPlanilha}: coluna "Imagens" deve ser uma lista não vazia de {url, legenda?}`)
  }
  return json.map((item, i) => {
    const url = (item as Partial<ImagemApoio>)?.url
    if (typeof url !== 'string' || !url) {
      throw new Error(`${idPlanilha}: imagens[${i}] precisa de "url" (string não vazia)`)
    }
    const legenda = (item as Partial<ImagemApoio>).legenda
    if (legenda !== undefined && typeof legenda !== 'string') {
      throw new Error(`${idPlanilha}: imagens[${i}].legenda deve ser string`)
    }
    return legenda ? { url, legenda } : { url }
  })
}

/** PRNG determinístico (mulberry32): mesma seed ⇒ mesma saída, sempre. */
function criarRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function embaralhar<T>(itens: T[], rand: () => number): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * Distribui as letras-alvo o mais uniformemente possível (25/25/25/25 em 100 questões)
 * e embaralha essa lista. Garante balanço exato, coisa que sortear letra a letra não faria.
 */
function gerarLetrasAlvo(total: number, rand: () => number): Letra[] {
  const alvos: Letra[] = []
  for (let i = 0; i < total; i++) alvos.push(LETRAS[i % 4])
  return embaralhar(alvos, rand)
}

/**
 * Reposiciona as alternativas para que a correta caia em `destino`.
 * Retorna as novas alternativas e o mapa letraAntiga → letraNova.
 */
function reposicionar(
  alternativas: Record<Letra, string>,
  correta: Letra,
  destino: Letra,
  rand: () => number,
) {
  const erradas = LETRAS.filter((l) => l !== correta)
  const posicoesLivres = LETRAS.filter((l) => l !== destino)
  const erradasEmbaralhadas = embaralhar([...erradas], rand)

  const mapa = { [correta]: destino } as Record<Letra, Letra>
  erradasEmbaralhadas.forEach((letraAntiga, i) => {
    mapa[letraAntiga] = posicoesLivres[i]
  })

  const novas = {} as Record<Letra, string>
  for (const letraAntiga of LETRAS) {
    novas[mapa[letraAntiga]] = alternativas[letraAntiga]
  }
  return { novas, mapa }
}

/**
 * Reescreve as letras citadas no comentário de erros.
 *
 * Formatos observados na planilha:
 *   "A: texto. C: texto. D: texto."   (99 questões)
 *   "B: texto. C e D: texto."         (1 questão — grupo combinado)
 *
 * Os trechos são reordenados por letra depois do remapeamento, para o comentário
 * continuar lendo em ordem alfabética.
 */
const RE_REFERENCIA = /(?<![A-Za-zÀ-ÿ])([A-D](?:\s*(?:,|\se\s)\s*[A-D])*)\s*:/g

function remapearComentarioErros(texto: string, mapa: Record<Letra, Letra>): string {
  if (!texto) return texto

  const matches = [...texto.matchAll(RE_REFERENCIA)]
  if (matches.length === 0) return texto

  const prefixo = texto.slice(0, matches[0].index).trim()

  const trechos = matches.map((m, i) => {
    const inicioTexto = m.index! + m[0].length
    const fimTexto = i + 1 < matches.length ? matches[i + 1].index! : texto.length
    const letrasNovas = [...m[1].matchAll(/[A-D]/g)]
      .map((l) => mapa[l[0] as Letra])
      .sort()
    return { letras: letrasNovas, corpo: texto.slice(inicioTexto, fimTexto).trim() }
  })

  trechos.sort((a, b) => a.letras[0].localeCompare(b.letras[0]))

  const corpo = trechos
    .map((t) => {
      const rotulo =
        t.letras.length === 1
          ? t.letras[0]
          : `${t.letras.slice(0, -1).join(', ')} e ${t.letras[t.letras.length - 1]}`
      return `${rotulo}: ${t.corpo}`
    })
    .join(' ')

  return prefixo ? `${prefixo} ${corpo}` : corpo
}

async function lerPlanilha(caminho: string): Promise<QuestaoPlanilha[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminho)
  const ws = wb.getWorksheet(ABA)
  if (!ws) throw new Error(`Aba "${ABA}" não encontrada em ${caminho}`)

  const questoes: QuestaoPlanilha[] = []
  ws.eachRow((row, numeroLinha) => {
    if (numeroLinha === 1) return // cabeçalho
    const t = (col: number) => String(row.getCell(col).text ?? '').trim()

    const enunciado = t(7)
    if (!enunciado) return // linhas ainda não produzidas (Simulados 2 e 3)

    const correta = t(12).toUpperCase() as Letra
    if (!LETRAS.includes(correta)) {
      throw new Error(`Linha ${numeroLinha}: resposta correta inválida "${t(12)}"`)
    }

    questoes.push({
      idPlanilha: t(1),
      simulado: Number(t(2)),
      numeroNaProva: Number(t(3)),
      area: t(4),
      subtema: t(5),
      dificuldade: t(6),
      enunciado,
      alternativas: { A: t(8), B: t(9), C: t(10), D: t(11) },
      correta,
      comentarioCorreta: t(13),
      comentarioErros: t(14),
      status: t(15) || 'Em revisão',
      // Coluna 16 ("Revisor") é só controle interno da planilha — não vai pro banco.
      tabelaDadosTexto: t(17),
      graficoSvg: t(18),
      imagensTexto: t(19),
    })
  })

  return questoes
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const planilha = process.env.PLANILHA_QUESTOES
  if (!planilha) throw new Error('Defina PLANILHA_QUESTOES no .env.local')

  const questoes = await lerPlanilha(resolve(planilha))
  console.log(`Lidas ${questoes.length} questões preenchidas da aba "${ABA}".`)

  const antes = contar(questoes.map((q) => q.correta))
  console.log(`Gabarito ORIGINAL (todos os simulados):  ${formatar(antes)}`)

  // Ordena por id para o embaralhamento não depender da ordem de leitura.
  questoes.sort((a, b) => a.idPlanilha.localeCompare(b.idPlanilha))

  // O rebalanceamento roda POR SIMULADO, nunca no lote combinado: um aluno
  // faz uma prova de cada vez, então quem precisa fechar ~25/25/25/25 é cada
  // simulado individual. Embaralhar as 300 questões juntas só garante esse
  // equilíbrio na MÉDIA dos 3 — um simulado isolado poderia sair 35/20/25/20
  // enquanto outro compensa, o que reabriria a brecha de "marcar sempre a
  // mesma letra" que este script existe para fechar.
  //
  // Processar os simulados em ordem crescente com o MESMO gerador de números
  // aleatórios (`rand`), começando do 1, mantém o resultado do Simulado 1
  // idêntico ao já importado antes de existirem os Simulados 2 e 3: com um
  // único grupo de 100, o consumo de `rand()` é byte a byte o mesmo do
  // algoritmo antigo (que também via as 100 questões como um grupo só).
  const porSimulado = new Map<number, QuestaoPlanilha[]>()
  for (const q of questoes) {
    if (!porSimulado.has(q.simulado)) porSimulado.set(q.simulado, [])
    porSimulado.get(q.simulado)!.push(q)
  }

  const rand = criarRandom(SEED)
  const registros: Record<string, unknown>[] = []

  for (const simulado of [...porSimulado.keys()].sort((a, b) => a - b)) {
    const grupo = porSimulado.get(simulado)!
    const alvos = gerarLetrasAlvo(grupo.length, rand)

    const registrosDoGrupo = grupo.map((q, i) => {
      const { novas, mapa } = reposicionar(q.alternativas, q.correta, alvos[i], rand)
      const comentarioErros = remapearComentarioErros(q.comentarioErros, mapa)

      // Invariantes: o embaralhamento não pode alterar o conteúdo, só a posição.
      if (novas[alvos[i]] !== q.alternativas[q.correta]) {
        throw new Error(`${q.idPlanilha}: alternativa correta se perdeu no reposicionamento`)
      }
      const conteudoAntes = [...LETRAS.map((l) => q.alternativas[l])].sort()
      const conteudoDepois = [...LETRAS.map((l) => novas[l])].sort()
      if (JSON.stringify(conteudoAntes) !== JSON.stringify(conteudoDepois)) {
        throw new Error(`${q.idPlanilha}: conjunto de alternativas mudou`)
      }
      const letrasCitadas = [...comentarioErros.matchAll(RE_REFERENCIA)]
        .flatMap((m) => [...m[1].matchAll(/[A-D]/g)].map((l) => l[0]))
        .sort()
      const erradasEsperadas = LETRAS.filter((l) => l !== alvos[i]).sort()
      if (
        letrasCitadas.length > 0 &&
        JSON.stringify([...new Set(letrasCitadas)]) !== JSON.stringify(erradasEsperadas)
      ) {
        throw new Error(
          `${q.idPlanilha}: comentário de erros cita ${letrasCitadas} mas as erradas são ${erradasEsperadas}`,
        )
      }

      return {
        id_planilha: q.idPlanilha,
        tipo: 'simulado' as const,
        simulado_numero: q.simulado,
        numero_na_prova: q.numeroNaProva,
        area: q.area,
        subtema: q.subtema || null,
        dificuldade: q.dificuldade || null,
        ano_origem: null,
        fonte: null,
        enunciado: q.enunciado,
        alternativa_a: novas.A,
        alternativa_b: novas.B,
        alternativa_c: novas.C,
        alternativa_d: novas.D,
        resposta_correta: alvos[i],
        comentario_correta: q.comentarioCorreta || null,
        comentario_erros: comentarioErros || null,
        status: q.status,
        tabela_dados: lerTabelaDados(q.tabelaDadosTexto, q.idPlanilha),
        grafico_svg: lerGraficoSvg(q.graficoSvg, q.idPlanilha),
        imagens: lerImagens(q.imagensTexto, q.idPlanilha),
      }
    })

    const gabaritoGrupo = contar(registrosDoGrupo.map((r) => r.resposta_correta as string))
    console.log(`  Simulado ${simulado} rebalanceado: ${formatar(gabaritoGrupo)}`)
    registros.push(...registrosDoGrupo)
  }

  const depois = contar(registros.map((r) => r.resposta_correta as string))
  console.log(`Gabarito REBALANCEADO (todos os simulados): ${formatar(depois)}`)

  // Artefatos de auditoria — permitem revisar o resultado sem abrir o banco.
  const destino = resolve('supabase/seed')
  mkdirSync(destino, { recursive: true })
  writeFileSync(`${destino}/questoes.json`, JSON.stringify(registros, null, 2), 'utf8')
  writeFileSync(`${destino}/questoes.sql`, gerarSql(registros), 'utf8')
  console.log(`Artefatos escritos em ${destino}/`)

  if (dryRun) {
    console.log('--dry-run: banco não foi tocado.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n' +
        'Rode com --dry-run para gerar apenas os artefatos.',
    )
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error, count } = await supabase
    .from('questoes')
    .upsert(registros, { onConflict: 'id_planilha', count: 'exact' })
  if (error) throw error

  console.log(`Upsert concluído: ${count ?? registros.length} questões no banco.`)
}

function contar(letras: string[]) {
  return letras.reduce<Record<string, number>>((acc, l) => ((acc[l] = (acc[l] ?? 0) + 1), acc), {})
}

function formatar(c: Record<string, number>) {
  return LETRAS.map((l) => `${l}=${c[l] ?? 0}`).join('  ')
}

function gerarSql(registros: Record<string, unknown>[]) {
  const colunas = Object.keys(registros[0])
  const valor = (v: unknown) =>
    v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`
  const linhas = registros
    .map((r) => `  (${colunas.map((c) => valor(r[c])).join(', ')})`)
    .join(',\n')
  return [
    '-- Gerado por scripts/import-questoes.ts. Não editar à mão.',
    `insert into public.questoes (${colunas.join(', ')})`,
    'values',
    `${linhas}`,
    'on conflict (id_planilha) do update set',
    colunas
      .filter((c) => c !== 'id_planilha')
      .map((c) => `  ${c} = excluded.${c}`)
      .join(',\n'),
    ';',
  ].join('\n')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
