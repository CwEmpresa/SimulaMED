import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AvisoConteudo } from '@/components/aviso-conteudo'
import { CascaApp } from '@/components/casca-app'
import { IconeCaderno, IconeCronometro, IconeGabarito } from '@/components/ui/icones'
import {
  BarraArea,
  CartaoComparativo,
  TituloSecao,
  botaoPrimario,
  botaoSecundario,
} from '@/components/ui/primitivos'
import { analisarAreaMaisFraca, formatarListaDeAreas } from '@/lib/diagnostico'
import { TOTAL_QUESTOES, formatarTempo } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

type DesempenhoArea = { acertos: number; total: number; percentual: number }

export default async function ResultadoPage({ params }: PageProps<'/simulados/resultado/[id]'>) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // O RLS já impede ler a tentativa de outro usuário; aqui só tratamos o "não existe".
  const { data: tentativa } = await supabase
    .from('tentativas_simulado')
    .select('id, simulado_numero, nota, tempo_usado_segundos, status, percentual_por_area')
    .eq('id', id)
    .maybeSingle()

  if (!tentativa) notFound()
  if (tentativa.status !== 'finalizado') {
    redirect(`/simulados/${tentativa.simulado_numero}/prova`)
  }

  // Outras tentativas finalizadas do MESMO simulado por este aluno — RLS já
  // restringe à própria linha, então isso nunca vaza nota de outro aluno.
  // "Sua melhor nota" só faz sentido (e só aparece) quando há mais de uma.
  const [{ data: outrasTentativas }, { data: mediaSimuladoRaw }] = await Promise.all([
    supabase
      .from('tentativas_simulado')
      .select('nota')
      .eq('simulado_numero', tentativa.simulado_numero)
      .eq('status', 'finalizado'),
    // Agregado apenas — media_simulado é SECURITY DEFINER e nunca devolve
    // uma linha de tentativa individual, só a média (ver migration 09).
    supabase.rpc('media_simulado', { p_simulado_numero: tentativa.simulado_numero }),
  ])

  const nota = Number(tentativa.nota ?? 0)
  const notasDoSimulado = (outrasTentativas ?? []).map((t) => Number(t.nota ?? 0))
  const melhorNota = notasDoSimulado.length ? Math.max(...notasDoSimulado) : nota
  const jaFezMaisDeUmaVez = notasDoSimulado.length > 1

  const mediaSimulado = mediaSimuladoRaw === null ? null : Number(mediaSimuladoRaw)
  const diferencaMedia = mediaSimulado === null ? null : Math.round(nota - mediaSimulado)

  const areas = Object.entries(
    (tentativa.percentual_por_area ?? {}) as Record<string, DesempenhoArea>,
  ).sort((a, b) => a[1].percentual - b[1].percentual) // pior primeiro

  const analiseArea = analisarAreaMaisFraca(
    areas.map(([area, d]) => ({ area, percentual: d.percentual })),
  )

  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
        <CartaoComparativo
          titulo={`Resultado do Simulado ${tentativa.simulado_numero}`}
          valorPrincipal={String(nota)}
          sufixoValor={`/${TOTAL_QUESTOES}`}
          diferenca={diferencaMedia}
          estatisticas={[
            { rotulo: 'Sua nota', valor: `${nota}/${TOTAL_QUESTOES}` },
            ...(jaFezMaisDeUmaVez
              ? [{ rotulo: 'Sua melhor nota', valor: `${melhorNota}/${TOTAL_QUESTOES}` }]
              : []),
            {
              rotulo: 'Média da turma',
              valor: mediaSimulado === null ? '—' : `${Math.round(mediaSimulado)}/${TOTAL_QUESTOES}`,
            },
          ]}
        />

        <p className="mt-3 flex items-center gap-2 text-sm text-texto-suave">
          <IconeCronometro className="size-4" />
          Tempo usado{' '}
          <span className="font-mono tabular-nums text-texto">
            {formatarTempo(tentativa.tempo_usado_segundos ?? 0)}
          </span>
        </p>

        <section
          className="mt-6 rounded-2xl border border-borda bg-superficie p-6
                     shadow-[var(--sombra-1)]"
        >
          <TituloSecao
            titulo="Desempenho por área"
            descricao="Da mais fraca para a mais forte."
          />

          <ul className="mt-6 flex flex-col gap-5">
            {areas.map(([area, d], i) => (
              <BarraArea
                key={area}
                indice={i}
                area={area}
                acertos={d.acertos}
                total={d.total}
                percentual={d.percentual}
              />
            ))}
          </ul>
        </section>

        {/* Só aponta uma área mais fraca quando ela é de fato mais fraca que as
            outras. Num empate — típico de quem deixou tudo em branco — eleger
            uma das empatadas por ordem de array seria conselho arbitrário;
            quando há empate real na pior posição, listamos todas. */}
        {analiseArea.tipo === 'ok' && (
          <p className="mt-4 rounded-xl bg-acento-suave px-4 py-3 text-sm text-acento">
            {analiseArea.areas.length === 1 ? 'Sua área mais fraca é' : 'Suas áreas mais fracas são'}{' '}
            <strong>{formatarListaDeAreas(analiseArea.areas)}</strong>, com{' '}
            <strong className="tabular-nums">{analiseArea.percentual}%</strong>. É por onde vale
            começar a revisão.
          </p>
        )}
        {analiseArea.tipo === 'empatado' && (
          <p className="mt-4 rounded-xl bg-superficie-2 px-4 py-3 text-sm text-texto-suave">
            Responda questões para gerar sua análise de desempenho por área.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/cadernos?origem=simulado" className={botaoPrimario}>
            <IconeCaderno className="size-4" />
            Revisar meus erros
          </Link>
          <Link href={`/simulados/resultado/${tentativa.id}/gabarito`} className={botaoSecundario}>
            <IconeGabarito className="size-4" />
            Ver gabarito
          </Link>
          <Link href="/simulados" className={botaoSecundario}>
            Voltar aos simulados
          </Link>
        </div>

        <AvisoConteudo className="mt-12" />
      </main>
    </CascaApp>
  )
}
