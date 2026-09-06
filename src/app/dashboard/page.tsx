import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CascaApp } from '@/components/casca-app'
import {
  CartaoMediaSimulados,
  type PontoMediaSimulado,
} from '@/components/dashboard/cartao-media-simulados'
import { ListaSimulados, type LinhaSimulado } from '@/components/dashboard/lista-simulados'
import {
  IconeAlerta,
  IconeBusca,
  IconeCaderno,
  IconeCronometro,
  IconeRaio,
  IconeSeta,
  IconeSino,
} from '@/components/ui/icones'
import {
  AnelProgresso,
  BarraArea,
  CartaoContraste,
  TituloSecao,
  botaoPrimario,
} from '@/components/ui/primitivos'
import { analisarAreaMaisFraca, calcularDesempenhoPorArea, formatarListaDeAreas } from '@/lib/diagnostico'
import { STATUS_APROVADA } from '@/lib/questoes'
import { SIMULADOS, TOTAL_QUESTOES, formatarTempo } from '@/lib/simulado'
import { createClient } from '@/lib/supabase/server'

function formatarSaudacao() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatarDataDeHoje() {
  const texto = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Média da plataforma: fixa em 65/100 enquanto a base de alunos ainda é
 * pequena demais para uma média real ter algum significado (poucas dezenas
 * de tentativas, fácil de um usuário só puxar o número pra qualquer lado).
 * Também alimenta a série de exemplo do gráfico quando o aluno ainda não tem
 * nenhuma tentativa própria (rotulada "Média da plataforma" no cartão, nunca
 * atribuída a ele) só para o cartão não nascer em branco.
 *
 * A série varia semana a semana (sobe e desce um pouco) em vez de subir em
 * linha reta, pra não parecer uma régua perfeita — mas a variação é pequena,
 * do tamanho do que uma média real oscilaria de uma semana pra outra.
 */
const MEDIA_PLATAFORMA_BASE = 65
const PONTOS_BASE_PLATAFORMA: PontoMediaSimulado[] = [
  { rotulo: 'Semana 1', nota: 62 },
  { rotulo: 'Semana 2', nota: 67 },
  { rotulo: 'Semana 3', nota: 64 },
  { rotulo: 'Semana 4', nota: 68 },
  { rotulo: 'Semana 5', nota: 63 },
  { rotulo: 'Semana 6', nota: 66 },
  { rotulo: 'Hoje', nota: 65 },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: perfil },
    { data: questoesSimulado },
    { count: totalBanco },
    { data: tentativas },
    { data: respostasBanco },
    { count: totalSimuladoRespondidas },
    { count: totalErros },
    { data: mediaGeralRaw },
  ] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nome, onboarding_concluido_em, recorde_combo')
      .eq('id', user?.id ?? '')
      .maybeSingle(),
    // Só as posições por simulado — o gabarito não faz parte das colunas
    // liberadas ao papel `authenticated` de qualquer forma.
    supabase
      .from('questoes')
      .select('simulado_numero')
      .eq('tipo', 'simulado')
      .eq('status', STATUS_APROVADA),
    // Contar com select('*') em `questoes` falha em silêncio (ver AGENTS.md):
    // o privilégio de coluna nega resposta_correta/comentários, e a contagem
    // volta nula sem erro. Sempre contar por uma coluna permitida.
    supabase
      .from('questoes')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'banco')
      .eq('status', STATUS_APROVADA),
    supabase
      .from('tentativas_simulado')
      .select('id, simulado_numero, status, nota, tempo_usado_segundos, finalizado_em, iniciado_em, percentual_por_area')
      .order('finalizado_em', { ascending: true }),
    supabase
      .from('respostas_banco')
      .select('correta, questoes (area)')
      .not('alternativa_escolhida', 'is', null),
    // respostas_simulado não tem coluna usuario_id — a posse vem só da tentativa
    // dona, e o RLS já restringe a leitura à própria; nada a filtrar aqui.
    supabase
      .from('respostas_simulado')
      .select('id', { count: 'exact', head: true })
      .not('alternativa_escolhida', 'is', null),
    supabase.from('caderno_erros').select('*', { count: 'exact', head: true }),
    // Agregado apenas — media_geral_plataforma é SECURITY DEFINER e nunca
    // devolve uma linha de tentativa individual, só a média (ver migration 09).
    supabase.rpc('media_geral_plataforma'),
  ])

  // Primeiro acesso: apresenta os quatro módulos antes do painel. A condição é
  // complementar à de /onboarding, então não há risco de pingue-pongue.
  if (user && perfil && !perfil.onboarding_concluido_em) redirect('/onboarding')

  const todasTentativas = tentativas ?? []
  const doBanco = respostasBanco ?? []

  const totalPorSimulado = new Map<number, number>()
  for (const q of questoesSimulado ?? []) {
    if (q.simulado_numero == null) continue
    totalPorSimulado.set(q.simulado_numero, (totalPorSimulado.get(q.simulado_numero) ?? 0) + 1)
  }

  // A ordenação ascendente por finalizado_em vem direto da query: em caso de
  // reforço do mesmo simulado, a última posição do array é sempre a mais
  // recente — mesmo critério usado por calcularDesempenhoPorArea.
  const finalizadas = todasTentativas.filter((t) => t.status === 'finalizado')
  const ultimaFinalizada = finalizadas.at(-1) ?? null

  const emAndamentoRows = todasTentativas.filter((t) => t.status === 'em_andamento')
  const emAndamentoAtual =
    emAndamentoRows.length > 1
      ? [...emAndamentoRows].sort((a, b) => (b.iniciado_em ?? '').localeCompare(a.iniciado_em ?? ''))[0]
      : (emAndamentoRows[0] ?? null)

  const linhasSimulados: LinhaSimulado[] = SIMULADOS.map((numero) => {
    const disponivel = (totalPorSimulado.get(numero) ?? 0) > 0
    const doSimulado = todasTentativas.filter((t) => t.simulado_numero === numero)
    const emAndamento = doSimulado.some((t) => t.status === 'em_andamento')
    const notasFinalizadas = doSimulado
      .filter((t) => t.status === 'finalizado')
      .map((t) => Number(t.nota ?? 0))
    const melhorNota = notasFinalizadas.length ? Math.max(...notasFinalizadas) : null

    return {
      numero,
      disponivel,
      status: emAndamento ? 'em_andamento' : melhorNota !== null ? 'finalizado' : 'nao_iniciado',
      melhorNota,
    }
  })

  const simuladosConcluidos = new Set(finalizadas.map((t) => t.simulado_numero)).size
  const totalQuestoesRespondidas = (totalSimuladoRespondidas ?? 0) + doBanco.length

  // "Sua média pessoal": todas as tentativas finalizadas de todos os
  // simulados, sem deduplicar por número — se o aluno refez o Simulado 1,
  // as duas notas entram na média, do mesmo jeito que media_geral_plataforma
  // soma todas as tentativas finalizadas da plataforma.
  const mediaPessoal = finalizadas.length
    ? finalizadas.reduce((soma, t) => soma + Number(t.nota ?? 0), 0) / finalizadas.length
    : null
  const mediaGeral = mediaGeralRaw === null ? MEDIA_PLATAFORMA_BASE : Number(mediaGeralRaw)
  const diferencaGeral =
    mediaPessoal === null || mediaGeral === null ? null : Math.round(mediaPessoal - mediaGeral)

  // Uma nota por tentativa finalizada, na ordem em que aconteceram — é a
  // série que o cartão de média usa para desenhar a evolução. `finalizadas`
  // já vem ordenada ascendente por finalizado_em. Sem nenhuma tentativa
  // própria ainda, cai na série de exemplo da plataforma (ver comentário da
  // constante) em vez de deixar o cartão sem gráfico.
  const usaMediaBase = finalizadas.length === 0
  const pontosMedia = usaMediaBase
    ? PONTOS_BASE_PLATAFORMA
    : finalizadas.map((t) => ({
        rotulo: `Simulado ${t.simulado_numero}`,
        nota: Number(t.nota ?? 0),
      }))

  // O anel mostra APROVEITAMENTO, não "quanto do banco você já fez". Um
  // percentual de cobertura entregaria o tamanho do acervo por divisão (3
  // respondidas marcando 1% ⇒ 300 questões), e o total é informação de
  // produção. Aproveitamento também é a métrica que o aluno pode agir sobre.
  const acertosBanco = doBanco.filter((r) => r.correta).length
  const aproveitamentoBanco = doBanco.length
    ? Math.round((100 * acertosBanco) / doBanco.length)
    : null

  const agregados = calcularDesempenhoPorArea(finalizadas, doBanco)
  const analiseArea = analisarAreaMaisFraca(agregados)

  const primeiroNome = perfil?.nome?.split(' ')[0]

  return (
    <CascaApp>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        {/* ── Boas-vindas: direto no fundo, sem cartão — é cabeçalho de página,
            não mais um bloco de conteúdo entre outros. ──────────────────── */}
        <section className="border-b border-borda pb-6 sm:pb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatarSaudacao()}
                {primeiroNome ? `, ${primeiroNome}` : ''}!
              </h1>
              <p className="mt-1 text-sm text-texto-suave">{formatarDataDeHoje()}</p>
            </div>

            {/* Busca e notificações: presentes por consistência com o resto do
                produto, mas honestamente desativadas — nenhuma das duas tem
                função ainda, e um controle clicável sem efeito é pior que a
                ausência dele. */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative hidden sm:block">
                <IconeBusca className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco" />
                <input
                  type="search"
                  disabled
                  placeholder="Buscar (em breve)"
                  title="Busca ainda não disponível"
                  className="w-40 cursor-not-allowed rounded-full border border-borda bg-superficie-2
                             py-2 pl-9 pr-3 text-xs text-texto-fraco placeholder:text-texto-fraco"
                />
              </div>
              <button
                type="button"
                disabled
                title="Notificações ainda não disponíveis"
                aria-label="Notificações (em breve)"
                className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center
                           rounded-full border border-borda text-texto-fraco"
              >
                <IconeSino className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-6">
            <div className="flex gap-8">
              <div>
                <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                  {totalQuestoesRespondidas}
                </p>
                <p className="text-xs text-texto-fraco">questões respondidas</p>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                  {simuladosConcluidos}
                  <span className="text-lg text-texto-fraco">/3</span>
                </p>
                <p className="text-xs text-texto-fraco">simulados concluídos</p>
              </div>
            </div>

            <Link href="/diagnostico" className={botaoPrimario}>
              Ver diagnóstico
              <IconeSeta className="size-4" />
            </Link>
          </div>
        </section>

        {/* ── Cartão de média: sempre visível, mesmo sem dados ───────────── */}
        <section className="mt-6">
          <CartaoMediaSimulados
            pontos={pontosMedia}
            mediaGeral={mediaGeral}
            mediaUsuario={mediaPessoal}
            diferenca={diferencaGeral}
            totalQuestoes={TOTAL_QUESTOES}
            baseline={usaMediaBase}
          />
        </section>

        {/* ── Linha A: simulados + área mais fraca ────────────────────────── */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-1)] lg:col-span-2">
            <TituloSecao
              titulo="Seus simulados"
              descricao="As três provas, de um jeito só."
              acao={
                <Link href="/simulados" className="text-sm font-medium text-acento hover:underline">
                  Ver tudo
                </Link>
              }
            />
            <div className="mt-5">
              <ListaSimulados linhas={linhasSimulados} />
            </div>
          </div>

          <CartaoContraste indice={1}>
            <p className="text-xs font-medium uppercase tracking-wide text-contraste-texto-suave">
              Sua área mais fraca
            </p>

            {analiseArea.tipo === 'ok' ? (
              <>
                <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
                  {formatarListaDeAreas(analiseArea.areas)}
                </h3>
                <p className="mt-1 font-display text-4xl font-semibold tabular-nums tracking-tight text-contraste-acento">
                  {analiseArea.percentual}%
                </p>
                <p className="mt-1 text-xs text-contraste-texto-suave">
                  {analiseArea.areas.length > 1
                    ? `${analiseArea.areas.length} áreas empatadas na pior posição`
                    : 'sua área com mais espaço para crescer'}
                </p>
                <Link
                  href={
                    analiseArea.areas.length === 1
                      ? `/banco?area=${encodeURIComponent(analiseArea.areas[0])}`
                      : '/banco'
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-contraste-acento-suave
                             px-4 py-2 text-sm font-medium text-contraste-acento transition-colors
                             hover:bg-contraste-acento hover:text-contraste-fundo"
                >
                  Praticar agora
                  <IconeSeta className="size-4" />
                </Link>
              </>
            ) : analiseArea.tipo === 'empatado' ? (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Desempenho parelho
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-contraste-texto-suave">
                  Responda questões para gerar sua análise de desempenho por área.
                </p>
              </>
            ) : analiseArea.tipo === 'tudo_bem' ? (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Nenhuma área fraca
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-contraste-texto-suave">
                  Seu desempenho está bom em todas as áreas até aqui. Continue assim.
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Ainda sem dados suficientes
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-contraste-texto-suave">
                  Termine um simulado ou responda algumas questões do banco para descobrirmos onde
                  focar.
                </p>
                <Link
                  href="/simulados"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-contraste-acento-suave
                             px-4 py-2 text-sm font-medium text-contraste-acento transition-colors
                             hover:bg-contraste-acento hover:text-contraste-fundo"
                >
                  Fazer um simulado
                  <IconeSeta className="size-4" />
                </Link>
              </>
            )}
          </CartaoContraste>
        </section>

        {/* ── Linha B: progresso do banco, caderno, último simulado ──────── */}
        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-borda bg-superficie p-6 text-center shadow-[var(--sombra-1)]">
            <AnelProgresso
              percentual={aproveitamentoBanco}
              rotulo="Aproveitamento no banco"
              valorCentral={aproveitamentoBanco === null ? '-' : `${aproveitamentoBanco}%`}
            />
            <p className="mt-3 text-xs text-texto-fraco">
              {!totalBanco
                ? 'banco ainda em produção'
                : doBanco.length === 0
                  ? 'nenhuma questão respondida ainda'
                  : `${acertosBanco} de ${doBanco.length} ${doBanco.length === 1 ? 'questão' : 'questões'}`}
            </p>
          </div>

          <CartaoContraste indice={0}>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-contraste-texto-suave">
              <IconeCaderno className="size-4" />
              Caderno de erros
            </p>
            <p className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight">
              {totalErros ?? 0}
            </p>
            <p className="mt-1 text-xs text-contraste-texto-suave">questões para revisar</p>
            <Link
              href="/cadernos"
              className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium
                         text-contraste-acento hover:underline"
            >
              Ver todos
              <IconeSeta className="size-4" />
            </Link>
          </CartaoContraste>

          <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-1)]">
            <p className="text-xs font-medium uppercase tracking-wide text-texto-fraco">
              Último simulado
            </p>
            {ultimaFinalizada ? (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Simulado {ultimaFinalizada.simulado_numero}
                </h3>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight">
                  {Number(ultimaFinalizada.nota ?? 0)}
                  <span className="text-base text-texto-fraco">/{TOTAL_QUESTOES}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-texto-fraco">
                  <IconeCronometro className="size-3.5" />
                  {formatarTempo(ultimaFinalizada.tempo_usado_segundos ?? 0)}
                </p>
                <Link
                  href={`/simulados/resultado/${ultimaFinalizada.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-acento
                             hover:underline"
                >
                  Ver resultado completo
                  <IconeSeta className="size-4" />
                </Link>
              </>
            ) : (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Nenhum ainda
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-texto-suave">
                  Assim que você terminar um simulado, o resultado aparece aqui.
                </p>
              </>
            )}
          </div>
        </section>

        {/* ── Linha C: desempenho por área + continue de onde parou ──────── */}
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-1)] lg:col-span-2">
            <TituloSecao
              titulo="Desempenho por área"
              descricao="Simulados e banco somados, da mais fraca para a mais forte."
            />
            {agregados.length > 0 ? (
              <ul className="mt-6 flex flex-col gap-5">
                {agregados.map((a, i) => (
                  <BarraArea
                    key={a.area}
                    indice={i}
                    area={a.area}
                    acertos={a.acertos}
                    total={a.total}
                    percentual={a.percentual}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-6 rounded-xl bg-superficie-2 px-4 py-3 text-sm text-texto-suave">
                Sem dados ainda. Faça um simulado para começar a ver isso aqui.
              </p>
            )}
          </div>

          <CartaoContraste indice={2}>
            <p className="text-xs font-medium uppercase tracking-wide text-contraste-texto-suave">
              Continue de onde parou
            </p>
            {emAndamentoAtual ? (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Simulado {emAndamentoAtual.simulado_numero}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-contraste-texto-suave">
                  <IconeAlerta className="size-4 shrink-0" />
                  Em andamento, o cronômetro não para.
                </p>
                <Link
                  href={`/simulados/${emAndamentoAtual.simulado_numero}/prova`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-contraste-acento-suave
                             px-4 py-2 text-sm font-medium text-contraste-acento transition-colors
                             hover:bg-contraste-acento hover:text-contraste-fundo"
                >
                  Retomar prova
                  <IconeSeta className="size-4" />
                </Link>
              </>
            ) : (
              <>
                <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                  Nada em andamento
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-contraste-texto-suave">
                  {simuladosConcluidos < 3
                    ? 'Comece o próximo simulado quando estiver pronto.'
                    : 'Você já concluiu os três, hora de focar no banco de questões e nos erros.'}
                </p>
                <Link
                  href={simuladosConcluidos < 3 ? '/simulados' : '/banco'}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-contraste-acento-suave
                             px-4 py-2 text-sm font-medium text-contraste-acento transition-colors
                             hover:bg-contraste-acento hover:text-contraste-fundo"
                >
                  {simuladosConcluidos < 3 ? 'Ir para os simulados' : 'Ir para o banco'}
                  <IconeSeta className="size-4" />
                </Link>
              </>
            )}
          </CartaoContraste>
        </section>

        {/* ── Convite ao Modo Combo ────────────────────────────────────────── */}
        <section className="mt-4">
          <Link
            href="/combo"
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border
                       border-borda bg-superficie p-6 shadow-[var(--sombra-1)] transition-[box-shadow,border-color]
                       duration-200 hover:border-borda-forte hover:shadow-[var(--sombra-2)]"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl
                           bg-acento-suave text-acento"
              >
                <IconeRaio className="size-5" />
              </span>
              <div>
                <p className="font-display text-base font-semibold tracking-tight">Modo Combo</p>
                <p className="mt-0.5 text-sm text-texto-suave">
                  Questões do banco, contra o relógio. Quanto tempo você aguenta sem errar?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">
                  {perfil?.recorde_combo ?? 0}
                </p>
                <p className="text-xs text-texto-fraco">seu recorde</p>
              </div>
              <span className={botaoPrimario}>
                Jogar
                <IconeSeta className="size-4" />
              </span>
            </div>
          </Link>
        </section>
      </main>
    </CascaApp>
  )
}
