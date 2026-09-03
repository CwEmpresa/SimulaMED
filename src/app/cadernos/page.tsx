import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { CascaApp } from '@/components/casca-app'
import { IconeCaderno } from '@/components/ui/icones'
import { EstadoVazio, botaoPrimario } from '@/components/ui/primitivos'
import { ALTERNATIVAS } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

const CAMPO_ALTERNATIVA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
} as const

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
      'id, origem, criado_em, questoes (id, numero_na_prova, simulado_numero, area, subtema, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d)',
    )
    .order('criado_em', { ascending: false })

  if (abaAtiva !== 'todos') query = query.eq('origem', abaAtiva)

  const { data: itens } = await query

  const idsQuestoes = (itens ?? []).map((i) => i.questoes?.id).filter((id): id is string => !!id)
  const { data: gabaritos } = idsQuestoes.length
    ? await supabase
        .from('gabaritos_liberados')
        .select('questao_id, resposta_correta, comentario_correta, comentario_erros')
        .in('questao_id', idsQuestoes)
    : { data: [] }

  const gabaritoPorQuestao = new Map(
    (gabaritos ?? []).map((g) => [g.questao_id, g]),
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

                      <ul className="mt-4 flex flex-col gap-1.5">
                        {ALTERNATIVAS.map((letra) => {
                          const texto = q[CAMPO_ALTERNATIVA[letra]]
                          const correta = gabarito?.resposta_correta === letra
                          return (
                            <li
                              key={letra}
                              className={`flex gap-2.5 rounded-lg px-3 py-2 text-sm ${
                                correta
                                  ? 'bg-acerto-suave text-acerto'
                                  : 'text-texto-suave'
                              }`}
                            >
                              <span className="font-semibold">{letra}</span>
                              <span className="leading-relaxed">{texto}</span>
                            </li>
                          )
                        })}
                      </ul>

                      {gabarito?.comentario_correta && (
                        <p className="mt-4 border-l-2 border-acento pl-3 text-sm leading-relaxed">
                          {gabarito.comentario_correta}
                        </p>
                      )}
                      {gabarito?.comentario_erros && (
                        <p className="mt-2 pl-3 text-sm leading-relaxed text-texto-suave">
                          {gabarito.comentario_erros}
                        </p>
                      )}
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
