'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { alternarRevisao, finalizarSimulado, salvarResposta } from '@/app/actions/simulado'
import { IconeAlerta, IconeSeta } from '@/components/ui/icones'
import { botaoPrimario, botaoSecundario } from '@/components/ui/primitivos'
import { ALTERNATIVAS, type Alternativa } from '@/lib/simulado'

import { Cronometro } from './cronometro'
import { NavegadorQuestoes, type SituacaoQuestao } from './navegador-questoes'

/** Note que o gabarito e os comentários NÃO fazem parte deste tipo: eles nunca
 *  são enviados ao cliente enquanto a prova está em andamento. */
export type QuestaoProva = {
  id: string
  numero_na_prova: number
  area: string
  subtema: string | null
  enunciado: string
  alternativa_a: string
  alternativa_b: string
  alternativa_c: string
  alternativa_d: string
}

/** Mapa explícito: indexar com `alternativa_${letra.toLowerCase()}` produz um
 *  tipo `string` genérico, que o TypeScript não aceita como chave. */
const CAMPO_ALTERNATIVA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
} as const satisfies Record<Alternativa, keyof QuestaoProva>

export type RespostaInicial = {
  questao_id: string
  alternativa_escolhida: string | null
  marcada_para_revisao: boolean
}

type Props = {
  tentativaId: string
  iniciadoEm: string
  simuladoNumero: number
  questoes: QuestaoProva[]
  respostasIniciais: RespostaInicial[]
}

export function TelaProva({
  tentativaId,
  iniciadoEm,
  simuladoNumero,
  questoes,
  respostasIniciais,
}: Props) {
  const [indice, setIndice] = useState(0)
  const [escolhas, setEscolhas] = useState<Record<string, Alternativa | undefined>>(() =>
    Object.fromEntries(
      respostasIniciais
        .filter((r) => r.alternativa_escolhida)
        .map((r) => [r.questao_id, r.alternativa_escolhida as Alternativa]),
    ),
  )
  const [revisao, setRevisao] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(respostasIniciais.map((r) => [r.questao_id, r.marcada_para_revisao])),
  )
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, iniciarEnvio] = useTransition()
  const jaEnviou = useRef(false)
  const reduzirMovimento = useReducedMotion()

  const questao = questoes[indice]

  const finalizar = useCallback(() => {
    if (jaEnviou.current) return
    jaEnviou.current = true
    iniciarEnvio(() => {
      void finalizarSimulado(tentativaId)
    })
  }, [tentativaId])

  /** Envio automático quando o tempo zera — sem confirmação, como na prova real. */
  const aoZerar = useCallback(() => finalizar(), [finalizar])

  function escolher(alternativa: Alternativa) {
    if (enviando || jaEnviou.current) return
    const anterior = escolhas[questao.id]
    setEscolhas((e) => ({ ...e, [questao.id]: alternativa })) // otimista
    setErro(null)

    void salvarResposta(tentativaId, questao.id, alternativa).then((r) => {
      if (!r.ok) {
        setEscolhas((e) => ({ ...e, [questao.id]: anterior })) // desfaz
        setErro(r.motivo)
      }
    })
  }

  function alternarMarcacao() {
    if (enviando || jaEnviou.current) return
    const novo = !revisao[questao.id]
    setRevisao((r) => ({ ...r, [questao.id]: novo }))
    setErro(null)

    void alternarRevisao(tentativaId, questao.id, novo).then((r) => {
      if (!r.ok) {
        setRevisao((rev) => ({ ...rev, [questao.id]: !novo }))
        setErro(r.motivo)
      }
    })
  }

  const irPara = useCallback(
    (i: number) => setIndice(Math.min(questoes.length - 1, Math.max(0, i))),
    [questoes.length],
  )

  // Atalhos de teclado: A–D escolhem, setas navegam. Numa prova cronometrada,
  // tirar a mão do teclado para clicar custa tempo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || confirmando) return
      const tecla = e.key.toUpperCase()
      if ((ALTERNATIVAS as readonly string[]).includes(tecla)) {
        e.preventDefault()
        escolher(tecla as Alternativa)
      } else if (e.key === 'ArrowRight') {
        irPara(indice + 1)
      } else if (e.key === 'ArrowLeft') {
        irPara(indice - 1)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const situacoes: SituacaoQuestao[] = questoes.map((q) => ({
    respondida: !!escolhas[q.id],
    revisao: !!revisao[q.id],
  }))

  const emBranco = situacoes.filter((s) => !s.respondida).length
  const marcadas = situacoes.filter((s) => s.revisao).length

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Em 375px o cronômetro e o botão consomem a linha: o rótulo encolhe
              em vez de truncar, para o aluno nunca perder de vista em que
              simulado e em que questão está. */}
          <div className="shrink-0">
            <p className="font-display text-sm font-semibold tracking-tight">
              Simulado {simuladoNumero}
            </p>
            <p className="text-xs text-texto-suave tabular-nums">
              <span className="sm:hidden">
                {indice + 1}/{questoes.length}
              </span>
              <span className="hidden sm:inline">
                Questão {indice + 1} de {questoes.length}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Cronometro iniciadoEm={iniciadoEm} aoZerar={aoZerar} />
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={enviando}
              className={botaoSecundario}
            >
              Finalizar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_260px]">
        <main>
          {erro && (
            <p
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-xl bg-erro-suave px-4 py-2.5
                         text-sm text-erro"
            >
              <IconeAlerta className="size-4 shrink-0" />
              {erro}
            </p>
          )}

          <AnimatePresence mode="wait">
            <motion.article
              key={questao.id}
              initial={reduzirMovimento ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduzirMovimento ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="rounded-2xl border border-borda bg-superficie p-5 shadow-[var(--sombra-1)] sm:p-7"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">
                  {questao.area}
                </span>
                {questao.subtema && <span>{questao.subtema}</span>}
              </div>

              <h1 className="mt-4 text-[15px] leading-relaxed sm:text-lg">{questao.enunciado}</h1>

              <fieldset className="mt-6">
                <legend className="sr-only">Alternativas</legend>
                <div className="flex flex-col gap-2">
                  {ALTERNATIVAS.map((letra) => {
                    const texto = questao[CAMPO_ALTERNATIVA[letra]]
                    const selecionada = escolhas[questao.id] === letra
                    return (
                      <label
                        key={letra}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 text-sm
                                    transition-colors duration-200 ${
                                      selecionada
                                        ? 'border-acento bg-acento-suave'
                                        : 'border-borda hover:border-borda-forte hover:bg-superficie-2'
                                    }`}
                      >
                        <input
                          type="radio"
                          name={`questao-${questao.id}`}
                          value={letra}
                          checked={selecionada}
                          onChange={() => escolher(letra)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full
                                      border text-xs font-semibold ${
                                        selecionada
                                          ? 'border-acento bg-acento text-acento-texto'
                                          : 'border-borda text-texto-suave'
                                      }`}
                        >
                          {letra}
                        </span>
                        <span className="leading-relaxed">{texto}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={alternarMarcacao}
                aria-pressed={!!revisao[questao.id]}
                className={`mt-5 cursor-pointer rounded-xl border px-3.5 py-2 text-sm transition-colors duration-200 ${
                  revisao[questao.id]
                    ? 'border-alerta/50 bg-alerta-suave text-alerta'
                    : 'border-borda text-texto-suave hover:bg-superficie-2'
                }`}
              >
                {revisao[questao.id] ? 'Marcada para revisão' : 'Marcar para revisão'}
              </button>
            </motion.article>
          </AnimatePresence>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => irPara(indice - 1)}
              disabled={indice === 0}
              className={`${botaoSecundario} disabled:opacity-40`}
            >
              <IconeSeta direcao="esquerda" className="size-4" />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => irPara(indice + 1)}
              disabled={indice === questoes.length - 1}
              className={`${botaoPrimario} disabled:opacity-40`}
            >
              Próxima
              <IconeSeta className="size-4" />
            </button>
          </div>
        </main>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <NavegadorQuestoes
            situacoes={situacoes}
            indiceAtual={indice}
            aoEscolher={irPara}
          />
        </aside>
      </div>

      {confirmando && (
        <ModalFinalizar
          emBranco={emBranco}
          marcadas={marcadas}
          enviando={enviando}
          aoCancelar={() => setConfirmando(false)}
          aoConfirmar={finalizar}
        />
      )}
    </div>
  )
}

function ModalFinalizar({
  emBranco,
  marcadas,
  enviando,
  aoCancelar,
  aoConfirmar,
}: {
  emBranco: number
  marcadas: number
  enviando: boolean
  aoCancelar: () => void
  aoConfirmar: () => void
}) {
  const botaoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    botaoRef.current?.focus()
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoCancelar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoCancelar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1119]/60 p-4 backdrop-blur-sm"
      onClick={aoCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-finalizar"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-borda bg-superficie p-6 shadow-[var(--sombra-3)]"
      >
        <h2 id="titulo-finalizar" className="font-display text-xl font-semibold tracking-tight">
          Finalizar a prova?
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-texto-suave">
          Depois de finalizar você não poderá alterar suas respostas.
        </p>

        <ul className="mt-4 flex flex-col gap-1.5 text-sm">
          <li className={emBranco > 0 ? 'text-erro' : 'text-texto-suave'}>
            <strong className="tabular-nums">{emBranco}</strong>{' '}
            {emBranco === 1 ? 'questão em branco' : 'questões em branco'}
          </li>
          <li className={marcadas > 0 ? 'text-alerta' : 'text-texto-suave'}>
            <strong className="tabular-nums">{marcadas}</strong>{' '}
            {marcadas === 1 ? 'questão marcada para revisão' : 'questões marcadas para revisão'}
          </li>
        </ul>

        <div className="mt-6 flex gap-3">
          <button
            ref={botaoRef}
            type="button"
            onClick={aoCancelar}
            className={`${botaoSecundario} flex-1`}
          >
            Continuar prova
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={enviando}
            className={`${botaoPrimario} flex-1`}
          >
            {enviando ? 'Enviando...' : 'Finalizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
