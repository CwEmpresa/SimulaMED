import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CascaApp } from '@/components/casca-app'
import { IconeBanco, IconeDiagnostico, IconeSimulado } from '@/components/ui/icones'
import {
  BarraArea,
  CartaoMetrica,
  EstadoVazio,
  TituloSecao,
  botaoPrimario,
  botaoSecundario,
} from '@/components/ui/primitivos'
import { analisarAreaMaisFraca, calcularDesempenhoPorArea, formatarListaDeAreas } from '@/lib/diagnostico'
import { TOTAL_QUESTOES } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default async function DiagnosticoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tentativas }, { data: respostasBanco }] = await Promise.all([
    supabase
      .from('tentativas_simulado')
      .select('id, simulado_numero, nota, finalizado_em, percentual_por_area')
      .eq('usuario_id', user.id)
      .eq('status', 'finalizado')
      .order('finalizado_em', { ascending: true }),
    supabase
      .from('respostas_banco')
      .select('correta, questoes (area)')
      .eq('usuario_id', user.id)
      .not('alternativa_escolhida', 'is', null),
  ])

  const finalizadas = tentativas ?? []
  const doBanco = respostasBanco ?? []

  if (finalizadas.length === 0 && doBanco.length === 0) {
    return (
      <Moldura>
        <div className="mt-6">
          <EstadoVazio
            icone={<IconeDiagnostico className="size-7" />}
            titulo="Ainda não há o que diagnosticar"
            descricao="O diagnóstico cruza o seu desempenho nos simulados com o do banco de questões para apontar onde você perde mais pontos. Faça um simulado para começar a alimentá-lo."
            acoes={
              <Link href="/simulados" className={botaoPrimario}>
                Fazer um simulado
              </Link>
            }
          />
        </div>
      </Moldura>
    )
  }

  const agregados = calcularDesempenhoPorArea(finalizadas, doBanco)
  const analiseArea = analisarAreaMaisFraca(agregados)

  // Só usado para a legenda "considerando a tentativa mais recente" abaixo —
  // a soma de verdade já vem do helper compartilhado.
  const simuladosDistintos = new Set(finalizadas.map((t) => t.simulado_numero)).size

  const totalAcertos = agregados.reduce((s, a) => s + a.acertos, 0)
  const totalQuestoes = agregados.reduce((s, a) => s + a.total, 0)
  const percentualGeral = totalQuestoes ? Math.round((100 * totalAcertos) / totalQuestoes) : 0

  return (
    <Moldura>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <CartaoMetrica
          indice={0}
          destaque
          icone={<IconeDiagnostico className="size-[18px]" />}
          titulo="Aproveitamento geral"
          valor={`${percentualGeral}%`}
          legenda={`${totalAcertos} de ${totalQuestoes} questões`}
        />
        <CartaoMetrica
          indice={1}
          icone={<IconeSimulado className="size-[18px]" />}
          titulo="Simulados concluídos"
          valor={`${simuladosDistintos}/3`}
          legenda={
            finalizadas.length > simuladosDistintos
              ? `${finalizadas.length} tentativas no total`
              : 'considerando a tentativa mais recente'
          }
        />
        <CartaoMetrica
          indice={2}
          icone={<IconeBanco className="size-[18px]" />}
          titulo="Questões do banco"
          valor={String(doBanco.length)}
          legenda={doBanco.length ? 'respondidas' : 'banco ainda em produção'}
        />
      </section>

      <section className="mt-10 rounded-2xl border border-borda bg-superficie p-6
                          shadow-[var(--sombra-1)]">
        <TituloSecao
          titulo="Onde você perde mais pontos"
          descricao="Simulados e banco somados, da área mais fraca para a mais forte."
        />

        <ul className="mt-6 flex flex-col gap-5">
          {agregados.map((a, i) => (
            <BarraArea
              key={a.area}
              indice={i}
              area={a.area}
              acertos={a.acertos}
              total={a.total}
              percentual={a.percentual}
              detalhe={
                a.doBanco > 0 ? `${a.deSimulado} de simulado · ${a.doBanco} do banco` : undefined
              }
            />
          ))}
        </ul>

        {/* Mesmo critério da tela de resultado: sem diferença entre as áreas,
            eleger a primeira seria conselho arbitrário; em empate de verdade
            na pior posição, listamos todas as empatadas. */}
        {analiseArea.tipo === 'ok' && (
          <p className="mt-6 rounded-xl bg-acento-suave px-4 py-3 text-sm text-acento">
            Comece por <strong>{formatarListaDeAreas(analiseArea.areas)}</strong>: é onde está a
            maior distância entre o que você acerta e o que a prova cobra.
          </p>
        )}
        {analiseArea.tipo === 'empatado' && (
          <p className="mt-6 rounded-xl bg-superficie-2 px-4 py-3 text-sm text-texto-suave">
            Responda questões para gerar sua análise de desempenho por área.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-borda bg-superficie p-6
                          shadow-[var(--sombra-1)]">
        <TituloSecao titulo="Evolução" />
        <Evolucao tentativas={finalizadas} />
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/cadernos" className={botaoPrimario}>
          Revisar meus erros
        </Link>
        <Link href="/simulados" className={botaoSecundario}>
          Ir para os simulados
        </Link>
      </div>

    </Moldura>
  )
}

/**
 * Evolução ao longo do tempo. Com uma única prova feita não existe tendência —
 * e desenhar um gráfico de um ponto só sugeriria uma informação que não há.
 * Por isso o estado parcial é explícito até haver a segunda tentativa.
 */
function Evolucao({
  tentativas,
}: {
  tentativas: { id: string; simulado_numero: number; nota: number | null; finalizado_em: string | null }[]
}) {
  if (tentativas.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-texto-suave">
        Nenhum simulado finalizado ainda.
      </p>
    )
  }

  const maior = Math.max(...tentativas.map((t) => Number(t.nota ?? 0)), 1)

  return (
    <>
      {tentativas.length === 1 && (
        <p className="mt-1 text-sm text-texto-suave">
          Com uma prova feita ainda não há tendência para mostrar. A curva ganha sentido a
          partir do segundo simulado.
        </p>
      )}

      <ol className="mt-4 flex items-end gap-3">
        {tentativas.map((t) => {
          const nota = Number(t.nota ?? 0)
          return (
            <li key={t.id} className="flex w-16 flex-col items-center gap-1.5">
              <span className="text-sm font-semibold tabular-nums">{nota}</span>
              <div
                className="w-full rounded-t bg-acento"
                style={{ height: `${Math.max(8, (nota / maior) * 96)}px` }}
                role="img"
                aria-label={`Simulado ${t.simulado_numero}: ${nota} de ${TOTAL_QUESTOES}`}
              />
              <span className="text-xs text-texto-fraco">Sim. {t.simulado_numero}</span>
              {t.finalizado_em && (
                <span className="text-xs text-texto-fraco">{formatarData(t.finalizado_em)}</span>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:py-10">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Diagnóstico
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-texto-suave">
            Tudo o que você já respondeu, somado, para achar onde vale investir o tempo que
            resta. Na reta final o ganho vem de estudar o que falta, não de estudar mais.
          </p>
        </header>

        {children}
      </main>
    </CascaApp>
  )
}
