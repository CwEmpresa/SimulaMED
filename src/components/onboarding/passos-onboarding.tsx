'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, useTransition } from 'react'

import { concluirOnboarding } from '@/app/actions/onboarding'

const PASSOS = [
  {
    marca: '01',
    titulo: 'Simulados',
    resumo: 'Faça a prova antes da prova.',
    texto:
      'Três provas completas de 100 questões em 5 horas, no mesmo formato e no mesmo tempo do exame. Sem pausa e com envio automático ao fim do tempo — a ideia é você já ter passado por isso quando o dia chegar.',
  },
  {
    marca: '02',
    titulo: 'Banco de questões',
    resumo: 'Treino avulso, com resposta na hora.',
    texto:
      'Aqui é o oposto do simulado: você responde e vê na mesma hora se acertou, com o comentário completo. Dá para filtrar por área, subtema e ano, e favoritar o que quiser rever depois.',
  },
  {
    marca: '03',
    titulo: 'Cadernos de erro',
    resumo: 'O que você errou não se perde.',
    texto:
      'Toda questão que você erra ou deixa em branco entra automaticamente no seu caderno, agrupada por área. É a lista do que estudar, montada pelo seu próprio desempenho em vez de por palpite.',
  },
  {
    marca: '04',
    titulo: 'Diagnóstico',
    resumo: 'Onde investir o tempo que resta.',
    texto:
      'Simulados e banco somados mostram onde você perde mais pontos. Na reta final o ganho não vem de estudar mais, vem de estudar o que está faltando.',
  },
]

export function PassosOnboarding() {
  const [passo, setPasso] = useState(0)
  const [concluindo, iniciarConclusao] = useTransition()
  const reduzirMovimento = useReducedMotion()

  const atual = PASSOS[passo]
  const ultimo = passo === PASSOS.length - 1

  function avancar() {
    if (ultimo) {
      iniciarConclusao(() => void concluirOnboarding())
      return
    }
    setPasso((p) => p + 1)
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-6 sm:p-8">
      <ol className="flex gap-1.5" aria-label="Progresso da apresentação">
        {PASSOS.map((p, i) => (
          <li
            key={p.marca}
            aria-current={i === passo ? 'step' : undefined}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= passo ? 'bg-acento' : 'bg-superficie-2'
            }`}
          >
            <span className="sr-only">
              {p.titulo}
              {i === passo ? ' (atual)' : ''}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={atual.marca}
          initial={reduzirMovimento ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduzirMovimento ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <p className="mt-8 font-mono text-xs text-texto-fraco">
            {atual.marca} / {String(PASSOS.length).padStart(2, '0')}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{atual.titulo}</h2>
          <p className="mt-1 text-sm font-medium text-acento">{atual.resumo}</p>
          <p className="mt-4 text-sm leading-relaxed text-texto-suave">{atual.texto}</p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          disabled={passo === 0 || concluindo}
          className="rounded-lg border border-borda px-4 py-2 text-sm transition-colors
                     hover:bg-superficie-2 disabled:opacity-40"
        >
          Voltar
        </button>

        <div className="flex items-center gap-3">
          {!ultimo && (
            <button
              type="button"
              onClick={() => iniciarConclusao(() => void concluirOnboarding())}
              disabled={concluindo}
              className="text-sm text-texto-suave underline underline-offset-4
                         hover:text-texto disabled:opacity-40"
            >
              Pular
            </button>
          )}
          <button
            type="button"
            onClick={avancar}
            disabled={concluindo}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-medium text-acento-texto
                       transition-colors hover:bg-acento-forte disabled:opacity-60"
          >
            {concluindo ? 'Abrindo...' : ultimo ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}
