import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { CascaApp } from '@/components/casca-app'
import { ApoioQuestao } from '@/components/questao/apoio-questao'
import { DetalheQuestao } from '@/components/revisao/detalhe-questao'
import { IconeCaderno } from '@/components/ui/icones'
import { EstadoVazio, botaoPrimario } from '@/components/ui/primitivos'
import type { Alternativa, ImagemApoio, TabelaDados } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

const ABAS = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'simulado', rotulo: 'Erros dos simulados' },
  { chave: 'banco', rotulo: 'Erros do banco' },
] as const

export default async function CadernosPage({ searchParams }: PageProps<'/cadernos'>) {
  const { origem } = await searchParams
  const abaAtiva = typeof origem === 'string' && ['simulado', 'banco'].includes(origem)
    ? origem
    : 'todos'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `questoes` não expõe mais gabarito nem comentários ao papel `authenticated`
  // (privilégio por coluna). O gabarito vem da view `gabaritos_liberados`, que
  // só devolve o que este usuário já concluiu.
  let query = supabase
    .from('caderno_erros')
    .select(
      'id, origem, criado_em, questoes (id, numero_na_prova, simulado_numero, area, subtema, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, tabela_dados, grafico_svg, imagens)',
    )
    .order('criado_em', { ascending: false })

  if (abaAtiva !== 'todos') query = query.eq('origem', abaAtiva)

  const { data: itens } = await query

  const idsQuestoes = (itens ?? []).map((i) => i.questoes?.id).filter((id): id is string => !!id)
  const idsSimulado = (itens ?? [])
    .filter((i) => i.origem === 'simulado')
    .map((i) => i.questoes?.id)
    .filter((id): id is string => !!id)

  const [{ data: gabaritos }, { data: escolhidasBanco }, { data: escolhidasSimulado }] =
    await Promise.all([
      idsQuestoes.length
        ? supabase
            .from('gabaritos_liberados')
            .select('questao_id, resposta_correta, comentario_correta, comentario_erros')
            .in('questao_id', idsQuestoes)
        : Promise.resolve({ data: [] }),
      supabase
        .from('respostas_banco')
        .select('questao_id, alternativa_escolhida')
        .eq('usuario_id', user.id),
      // caderno_erros não guarda qual tentativa gerou a entrada nem qual
      // alternativa foi marcada (é deduplicado entre tentativas do mesmo
      // simulado) — por isso a resposta marcada vem desta view, filtrada só
      // pelas questões erradas de fato (a migração já garante que só entram
      // erros respondidos; aqui repetimos o filtro por segurança/clareza).
      idsSimulado.length
        ? supabase
            .from('respostas_simulado_detalhadas')
            .select('questao_id, alternativa_escolhida, respondido_em')
            .eq('usuario_id', user.id)
            .eq('correta', false)
            .not('alternativa_escolhida', 'is', null)
            .in('questao_id', idsSimulado)
            .order('respondido_em', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

  const gabaritoPorQuestao = new Map(
    (gabaritos ?? []).map((g) => [g.questao_id, g]),
  )

  // Se o simulado foi refeito, pode haver mais de uma resposta errada para a
  // mesma questão ao longo do tempo — fica a mais recente (a lista já vem
  // ordenada por respondido_em decrescente, então o primeiro Map.set vale).
  const escolhaSimuladoPorQuestao = new Map<string, string>()
  for (const r of escolhidasSimulado ?? []) {
    if (!escolhaSimuladoPorQuestao.has(r.questao_id!) && r.alternativa_escolhida) {
      escolhaSimuladoPorQuestao.set(r.questao_id!, r.alternativa_escolhida)
    }
  }
  const escolhaBancoPorQuestao = new Map(
    (escolhidasBanco ?? [])
      .filter((r) => r.alternativa_escolhida)
      .map((r) => [r.questao_id, r.alternativa_escolhida as string]),
  )

  const porArea = new Map<string, NonNullable<typeof itens>>()
  for (const item of itens ?? []) {
    if (!item.questoes) continue
    const area = item.questoes.area
    porArea.set(area, [...(porArea.get(area) ?? []), item])
  }
  const areas = [...porArea.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <CascaApp>
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Cadernos de erro
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
          Tudo o que você errou ou deixou em branco, agrupado por área. É a lista do que
          estudar, montada pelo seu desempenho em vez de por palpite.
        </p>
      </header>

      <nav
        aria-label="Filtrar por origem"
        className="mt-6 inline-flex flex-wrap gap-1 rounded-xl border border-borda
                   bg-superficie p-1 shadow-[var(--sombra-1)]"
      >
        {ABAS.map((aba) => (
          <Link
            key={aba.chave}
            href={aba.chave === 'todos' ? '/cadernos' : `/cadernos?origem=${aba.chave}`}
            aria-current={abaAtiva === aba.chave ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              abaAtiva === aba.chave
                ? 'bg-acento font-medium text-acento-texto'
                : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'
            }`}
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      {areas.length === 0 ? (
        <div className="mt-8">
          <EstadoVazio
            icone={<IconeCaderno className="size-7" />}
            titulo="Nada para revisar ainda"
            descricao="Seus erros aparecem aqui automaticamente depois que você finaliza um simulado ou responde questões do banco. Nada se perde."
            acoes={
              <Link href="/simulados" className={botaoPrimario}>
                Fazer um simulado
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {areas.map(([area, itensDaArea]) => (
            <section key={area}>
              <h2 className="flex items-baseline justify-between gap-3 font-display text-lg font-semibold tracking-tight">
                {area}
                <span className="text-sm font-normal tabular-nums text-texto-suave">
                  {itensDaArea.length} {itensDaArea.length === 1 ? 'questão' : 'questões'}
                </span>
              </h2>

              <ul className="mt-3 flex flex-col gap-3">
                {itensDaArea.map((item) => {
                  const q = item.questoes!
                  const gabarito = gabaritoPorQuestao.get(q.id)
                  const respostaEscolhida =
                    item.origem === 'banco'
                      ? (escolhaBancoPorQuestao.get(q.id) as Alternativa | undefined)
                      : (escolhaSimuladoPorQuestao.get(q.id) as Alternativa | undefined)

                  return (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-borda bg-superficie p-5
                                 shadow-[var(--sombra-1)]"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                        {q.simulado_numero && (
                          <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">
                            Simulado {q.simulado_numero} · Q{q.numero_na_prova}
                          </span>
                        )}
                        {q.subtema && <span>{q.subtema}</span>}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed">{q.enunciado}</p>

                      <ApoioQuestao
                        tabelaDados={q.tabela_dados as TabelaDados | null}
                        graficoSvg={q.grafico_svg}
                        imagens={q.imagens as ImagemApoio[] | null}
                      />

                      <DetalheQuestao
                        questao={q}
                        respostaCorreta={(gabarito?.resposta_correta as Alternativa) ?? null}
                        respostaEscolhida={respostaEscolhida ?? null}
                        comentarioCorreta={gabarito?.comentario_correta}
                        comentarioErros={gabarito?.comentario_erros}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AvisoConteudo className="mt-12" />
    </main>
    </CascaApp>
  )
}
