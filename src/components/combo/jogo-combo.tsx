'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { registrarRecordeCombo } from '@/app/actions/combo'
import { responderBanco } from '@/app/actions/banco'
import type { QuestaoBanco } from '@/components/banco/praticar-banco'
import { ApoioQuestao } from '@/components/questao/apoio-questao'
import { IconeCronometro, IconeRaio } from '@/components/ui/icones'
import { botaoPrimario, botaoSecundario } from '@/components/ui/primitivos'
import { ALTERNATIVAS, type Alternativa } from '@/lib/simulado'

const CAMPO_ALTERNATIVA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
} as const satisfies Record<Alternativa, keyof QuestaoBanco>

/** Janela por questão. Curta o bastante pra criar tensão, longa o bastante pra ler o enunciado. */
const SEGUNDOS_POR_QUESTAO = 18
/** Abaixo disso o contador vira vermelho — mesmo princípio do cronômetro do Modo Prova. */
const SEGUNDOS_CRITICOS = 5

type Fase = 'inicio' | 'jogando' | 'fim'

type Correcao = {
  acertou: boolean
  respostaCorreta: Alternativa
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * Cronômetro regressivo de uma questão. Recebe `key={questaoAtual.id}` do
 * componente pai — é assim que ele reseta a cada nova questão, sem precisar
 * de um `setState` síncrono dentro de um efeito (o React desaconselha: causa
 * re-renders em cascata). Remontar via key é o padrão idiomático para "este
 * estado deve reiniciar quando X muda".
 *
 * `pausado` substitui o que antes era um ref manual (`resolvidaRef`): assim
 * que a questão é resolvida por resposta, o pai marca `pausado`, o efeito
 * para de reagendar o próprio `setTimeout` e nunca chama `onEsgotar` depois
 * disso — sem essa trava, um timeout que dispara bem depois de uma resposta
 * já processada encerraria a sessão pela segunda vez.
 */
function CronometroQuestao({
  duracao,
  critico,
  pausado,
  onEsgotar,
}: {
  duracao: number
  critico: number
  pausado: boolean
  onEsgotar: () => void
}) {
  const [segundos, setSegundos] = useState(duracao)

  useEffect(() => {
    if (pausado || segundos <= 0) return
    const id = setTimeout(() => setSegundos((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [segundos, pausado])

  useEffect(() => {
    if (!pausado && segundos <= 0) onEsgotar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, pausado])

  return (
    <div
      className={`flex items-center gap-1.5 text-sm font-medium tabular-nums ${
        segundos <= critico ? 'text-erro' : 'text-texto-suave'
      }`}
    >
      <IconeCronometro className="size-4" />
      {segundos}s
    </div>
  )
}

export function JogoCombo({
  questoes,
  recordeInicial,
}: {
  questoes: QuestaoBanco[]
  recordeInicial: number
}) {
  const [fase, setFase] = useState<Fase>('inicio')
  const [fila, setFila] = useState<QuestaoBanco[]>(() => embaralhar(questoes))
  const [indice, setIndice] = useState(0)
  const [combo, setCombo] = useState(0)
  const [recorde, setRecorde] = useState(recordeInicial)
  const [comboFinal, setComboFinal] = useState(0)
  const [novoRecorde, setNovoRecorde] = useState(false)
  const [escolhida, setEscolhida] = useState<Alternativa | null>(null)
  const [correcao, setCorrecao] = useState<Correcao | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const reduzirMovimento = useReducedMotion()

  // "Últimos valores" lidos pelo efeito de persistência do recorde (abaixo),
  // que não pode depender de `combo`/`recorde` no array de dependências sem
  // reexecutar a cada mudança deles — só deve rodar quando `fase` vira 'fim'.
  // Sincronizados via efeito, nunca escritos direto no corpo do componente:
  // mutar um ref durante o render é outra coisa que o React desaconselha.
  const comboFinalRef = useRef(0)
  const recordeRef = useRef(recordeInicial)
  useEffect(() => {
    recordeRef.current = recorde
  }, [recorde])

  const questaoAtual = fila[indice]

  /**
   * Persiste o recorde quando a sessão termina. Vive num `useEffect`, e não
   * dentro do código que decide o fim de jogo (resposta errada ou tempo
   * esgotado), de propósito: chamar a Server Action direto de um callback de
   * timer disparava "Cannot update a component (Router) while rendering a
   * different component" — o Router do App Router atualiza como efeito
   * colateral de qualquer Server Action, e isso só é seguro no momento que o
   * React já reserva para efeitos colaterais, que é justamente aqui.
   */
  useEffect(() => {
    if (fase !== 'fim') return
    let cancelado = false

    registrarRecordeCombo(comboFinalRef.current).then((r) => {
      if (cancelado || !r.ok) return
      setNovoRecorde(r.recorde > recordeRef.current)
      setRecorde(r.recorde)
    })

    return () => {
      cancelado = true
    }
  }, [fase])

  function iniciar() {
    setFila(embaralhar(questoes))
    setIndice(0)
    setCombo(0)
    setEscolhida(null)
    setCorrecao(null)
    setErro(null)
    setNovoRecorde(false)
    setFase('jogando')
  }

  /**
   * Fim de sessão, seja por erro ou por tempo esgotado. Só mexe em estado
   * local — quem persiste o recorde é o `useEffect` acima, reagindo à
   * mudança de fase (ver o comentário lá para o porquê da separação).
   */
  function finalizarSessao(comboDaSessao: number) {
    comboFinalRef.current = comboDaSessao
    setComboFinal(comboDaSessao)
    setFase('fim')
  }

  async function responder(alternativa: Alternativa) {
    if (correcao || carregando) return
    setCarregando(true)
    setErro(null)
    setEscolhida(alternativa)

    const r = await responderBanco(questaoAtual.id, alternativa)
    setCarregando(false)

    if (!r.ok) {
      setEscolhida(null)
      setErro(r.motivo)
      return
    }

    setCorrecao({ acertou: r.acertou, respostaCorreta: r.respostaCorreta })

    if (r.acertou) {
      const proximoCombo = combo + 1
      setCombo(proximoCombo)
      window.setTimeout(() => {
        setIndice((i) => {
          const proximo = i + 1
          if (proximo >= fila.length) {
            setFila(embaralhar(questoes))
            return 0
          }
          return proximo
        })
        setEscolhida(null)
        setCorrecao(null)
      }, 550)
    } else {
      window.setTimeout(() => finalizarSessao(combo), 1100)
    }
  }

  if (fase === 'inicio') {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-8 text-center shadow-[var(--sombra-1)]">
        <span
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-acento-suave text-acento"
        >
          <IconeRaio className="size-7" />
        </span>
        <p className="mt-5 text-sm text-texto-suave">
          {recordeInicial > 0 ? 'Seu recorde' : 'Você ainda não tem recorde — que tal o primeiro?'}
        </p>
        {recordeInicial > 0 && (
          <p className="font-display text-5xl font-semibold tabular-nums tracking-tight text-acento">
            {recordeInicial}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-texto-suave">
          {SEGUNDOS_POR_QUESTAO} segundos por questão. Acerte para manter o combo, erre ou deixe o
          tempo passar e a sessão termina ali — sem limite de tentativas por dia.
        </p>
        <button type="button" onClick={iniciar} className={`${botaoPrimario} mt-6`}>
          Começar
        </button>
      </div>
    )
  }

  if (fase === 'fim') {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-8 text-center shadow-[var(--sombra-1)]">
        <p className="text-sm font-medium text-texto-suave">
          {novoRecorde ? 'Novo recorde!' : comboFinal === 0 ? 'Não foi dessa vez' : 'Combo encerrado'}
        </p>
        <p className="mt-2 font-display text-6xl font-semibold tabular-nums tracking-tight text-acento">
          {comboFinal}
        </p>
        <p className="mt-2 text-sm text-texto-suave">
          {comboFinal === 0
            ? 'Bora tentar de novo?'
            : comboFinal === 1
              ? 'Você acertou 1 antes de parar.'
              : `Você acertou ${comboFinal} seguidas!`}
        </p>
        <p className="mt-1 text-xs text-texto-fraco">
          {novoRecorde ? 'Seu recorde anterior ficou pra trás.' : `Seu recorde: ${recorde}`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={iniciar} className={botaoPrimario}>
            Jogar de novo
          </button>
          <Link href="/dashboard" className={botaoSecundario}>
            Voltar ao painel
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full bg-acento-suave px-3 py-1.5">
          <IconeRaio className="size-4 text-acento" />
          <span className="font-display text-sm font-semibold tabular-nums text-acento">
            Combo {combo}
          </span>
        </div>
        <CronometroQuestao
          key={questaoAtual.id}
          duracao={SEGUNDOS_POR_QUESTAO}
          critico={SEGUNDOS_CRITICOS}
          pausado={!!correcao}
          onEsgotar={() => finalizarSessao(combo)}
        />
      </div>

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-erro-suave px-4 py-2.5 text-sm text-erro">
          {erro}
        </p>
      )}

      <AnimatePresence mode="wait">
        <motion.article
          key={questaoAtual.id}
          initial={reduzirMovimento ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-3 rounded-xl border border-borda bg-superficie p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
            <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">
              {questaoAtual.area}
            </span>
            {questaoAtual.subtema && <span>{questaoAtual.subtema}</span>}
          </div>

          <h2 className="mt-4 text-base leading-relaxed sm:text-lg">{questaoAtual.enunciado}</h2>

          <ApoioQuestao
            tabelaDados={questaoAtual.tabela_dados}
            graficoSvg={questaoAtual.grafico_svg}
            imagens={questaoAtual.imagens}
          />

          <div className="mt-6 flex flex-col gap-2">
            {ALTERNATIVAS.map((letra) => {
              const texto = questaoAtual[CAMPO_ALTERNATIVA[letra]]
              const eraCorreta = correcao?.respostaCorreta === letra
              const foiEscolhida = escolhida === letra

              const estilo = !correcao
                ? foiEscolhida
                  ? 'border-acento bg-acento-suave'
                  : 'border-borda hover:bg-superficie-2'
                : eraCorreta
                  ? 'border-acerto bg-acerto-suave'
                  : foiEscolhida
                    ? 'border-erro bg-erro-suave'
                    : 'border-borda opacity-60'

              return (
                <button
                  key={letra}
                  type="button"
                  onClick={() => responder(letra)}
                  disabled={!!correcao || carregando}
                  className={`flex gap-3 rounded-lg border p-3 text-left text-sm transition-colors
                              ${estilo} ${correcao ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border
                                text-xs font-semibold ${
                                  correcao && eraCorreta
                                    ? 'border-acerto bg-acerto text-acerto-texto'
                                    : correcao && foiEscolhida
                                      ? 'border-erro bg-erro text-erro-texto'
                                      : foiEscolhida
                                        ? 'border-acento bg-acento text-acento-texto'
                                        : 'border-borda text-texto-suave'
                                }`}
                  >
                    {letra}
                  </span>
                  <span className="leading-relaxed">{texto}</span>
                </button>
              )
            })}
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
  )
}
