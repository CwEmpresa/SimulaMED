'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { alternarFavorito, responderBanco } from '@/app/actions/banco'
import { ALTERNATIVAS, type Alternativa } from '@/lib/simulado'

export type QuestaoBanco = {
  id: string
  area: string
  subtema: string | null
  dificuldade: string | null
  ano_origem: number | null
  fonte: string | null
  enunciado: string
  alternativa_a: string
  alternativa_b: string
  alternativa_c: string
  alternativa_d: string
}

export type EstadoInicial = {
  questao_id: string
  alternativa_escolhida: string | null
  favorito: boolean
}

/** Correção de questões que o aluno já respondeu em sessões anteriores. */
export type CorrecaoInicial = {
  questao_id: string
  escolhida: string | null
  resposta_correta: string
  comentario_correta: string | null
  comentario_erros: string | null
}

const CAMPO_ALTERNATIVA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
} as const satisfies Record<Alternativa, keyof QuestaoBanco>

type Correcao = {
  acertou: boolean
  respostaCorreta: Alternativa
  comentarioCorreta: string | null
  comentarioErros: string | null
}

export function PraticarBanco({
  questoes,
  estadoInicial,
  correcoesIniciais,
}: {
  questoes: QuestaoBanco[]
  estadoInicial: EstadoInicial[]
  correcoesIniciais: CorrecaoInicial[]
}) {
  const [indice, setIndice] = useState(0)
  const [correcoes, setCorrecoes] = useState<Record<string, Correcao>>(() =>
    Object.fromEntries(
      correcoesIniciais.map((c) => [
        c.questao_id,
        {
          acertou: c.escolhida === c.resposta_correta,
          respostaCorreta: c.resposta_correta as Alternativa,
          comentarioCorreta: c.comentario_correta,
          comentarioErros: c.comentario_erros,
        },
      ]),
    ),
  )
  const [favoritos, setFavoritos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(estadoInicial.map((e) => [e.questao_id, e.favorito])),
  )
  const [escolha, setEscolha] = useState<Record<string, Alternativa>>(() =>
    Object.fromEntries(
      estadoInicial
        .filter((e) => e.alternativa_escolhida)
        .map((e) => [e.questao_id, e.alternativa_escolhida as Alternativa]),
    ),
  )
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const reduzirMovimento = useReducedMotion()

  const questao = questoes[indice]
  const correcao = correcoes[questao.id]
  const respondida = !!correcao
  const escolhida = escolha[questao.id]

  async function responder(alternativa: Alternativa) {
    if (respondida || carregando) return
    setCarregando(true)
    setErro(null)
    setEscolha((e) => ({ ...e, [questao.id]: alternativa }))

    const r = await responderBanco(questao.id, alternativa)
    setCarregando(false)

    if (!r.ok) {
      setEscolha((e) => {
        const copia = { ...e }
        delete copia[questao.id]
        return copia
      })
      setErro(r.motivo)
      return
    }

    setCorrecoes((c) => ({
      ...c,
      [questao.id]: {
        acertou: r.acertou,
        respostaCorreta: r.respostaCorreta,
        comentarioCorreta: r.comentarioCorreta,
        comentarioErros: r.comentarioErros,
      },
    }))
  }

  async function favoritar() {
    const novo = !favoritos[questao.id]
    setFavoritos((f) => ({ ...f, [questao.id]: novo }))
    const r = await alternarFavorito(questao.id, novo)
    if (!r.ok) {
      setFavoritos((f) => ({ ...f, [questao.id]: !novo }))
      setErro(r.motivo ?? 'Não foi possível favoritar.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm text-texto-suave">
        <span className="tabular-nums">
          Questão {indice + 1} de {questoes.length}
        </span>
        <button
          type="button"
          onClick={favoritar}
          aria-pressed={!!favoritos[questao.id]}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            favoritos[questao.id]
              ? 'border-alerta/50 bg-alerta-suave text-alerta'
              : 'border-borda text-texto-suave hover:bg-superficie-2'
          }`}
        >
          {favoritos[questao.id] ? '★ Favoritada' : '☆ Favoritar'}
        </button>
      </div>

      {erro && (
        <p role="alert" className="mt-3 rounded-lg bg-erro-suave px-4 py-2.5 text-sm text-erro">
          {erro}
        </p>
      )}

      <article className="mt-3 rounded-xl border border-borda bg-superficie p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">{questao.area}</span>
          {questao.subtema && <span>{questao.subtema}</span>}
          {questao.dificuldade && <span>· {questao.dificuldade}</span>}
          {questao.ano_origem && <span>· {questao.ano_origem}</span>}
          {questao.fonte && <span>· {questao.fonte}</span>}
        </div>

        <h2 className="mt-4 text-base leading-relaxed sm:text-lg">{questao.enunciado}</h2>

        <div className="mt-6 flex flex-col gap-2">
          {ALTERNATIVAS.map((letra) => {
            const texto = questao[CAMPO_ALTERNATIVA[letra]]
            const eraCorreta = correcao?.respostaCorreta === letra
            const foiEscolhida = escolhida === letra

            // Antes de responder: só a seleção. Depois: a correta sempre em
            // verde, e a escolhida em vermelho quando o aluno errou.
            const estilo = !respondida
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
                disabled={respondida || carregando}
                aria-label={
                  respondida
                    ? `Alternativa ${letra}${eraCorreta ? ', correta' : foiEscolhida ? ', sua resposta, incorreta' : ''}`
                    : `Alternativa ${letra}`
                }
                className={`flex gap-3 rounded-lg border p-3 text-left text-sm transition-colors
                            ${estilo} ${respondida ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border
                              text-xs font-semibold ${
                                respondida && eraCorreta
                                  ? 'border-acerto bg-acerto text-acerto-texto'
                                  : respondida && foiEscolhida
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

        <AnimatePresence>
          {correcao && (
            <motion.div
              initial={reduzirMovimento ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-borda pt-4">
                <p
                  className={`text-sm font-semibold ${
                    correcao.acertou ? 'text-acerto' : 'text-erro'
                  }`}
                  role="status"
                >
                  {correcao.acertou
                    ? 'Você acertou.'
                    : `Você errou. A resposta correta é ${correcao.respostaCorreta}.`}
                </p>

                {correcao.comentarioCorreta && (
                  <p className="mt-3 border-l-2 border-acento pl-3 text-sm leading-relaxed">
                    {correcao.comentarioCorreta}
                  </p>
                )}
                {correcao.comentarioErros && (
                  <p className="mt-2 pl-3 text-sm leading-relaxed text-texto-suave">
                    {correcao.comentarioErros}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
          className="rounded-lg border border-borda px-4 py-2 text-sm transition-colors
                     hover:bg-superficie-2 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => setIndice((i) => Math.min(questoes.length - 1, i + 1))}
          disabled={indice === questoes.length - 1}
          className="rounded-lg bg-acento px-4 py-2 text-sm font-medium text-acento-texto
                     transition-colors hover:bg-acento-forte disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
