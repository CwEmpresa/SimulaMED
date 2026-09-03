'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { IconeCronometro } from '@/components/ui/icones'
import {
  ALERTA_SEGUNDOS,
  CRITICO_SEGUNDOS,
  formatarTempo,
  segundosRestantes,
  tempoParaLeitorDeTela,
} from '@/lib/simulado'

type Props = {
  iniciadoEm: string
  aoZerar: () => void
}

/**
 * Cronômetro regressivo da prova.
 *
 * O tempo é recalculado a cada tick a partir de `iniciadoEm` (vindo do banco),
 * e não decrementado de um contador local — assim um refresh, uma aba em
 * segundo plano ou um travamento não fazem o relógio derivar do tempo real.
 */
export function Cronometro({ iniciadoEm, aoZerar }: Props) {
  // Começa nulo de propósito: calcular o tempo durante o SSR e de novo na
  // hidratação produz valores diferentes (os relógios não coincidem) e o React
  // descarta a árvore com erro de hydration. O relógio só existe no cliente.
  const [restantes, setRestantes] = useState<number | null>(null)
  const reduzirMovimento = useReducedMotion()

  useEffect(() => {
    function tick() {
      const r = segundosRestantes(iniciadoEm)
      setRestantes(r)
      return r
    }

    if (tick() <= 0) {
      aoZerar()
      return
    }

    const id = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(id)
        aoZerar()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [iniciadoEm, aoZerar])

  const critico = restantes !== null && restantes <= CRITICO_SEGUNDOS
  const alerta = !critico && restantes !== null && restantes <= ALERTA_SEGUNDOS

  const cor = critico
    ? 'text-erro border-erro/40 bg-erro-suave'
    : alerta
      ? 'text-alerta border-alerta/40 bg-alerta-suave'
      : 'text-texto border-borda bg-superficie-2'

  return (
    <motion.div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 tabular-nums ${cor}`}
      // O pulso só existe na faixa crítica e é sutil: serve para puxar o olhar
      // de quem está imerso na questão, não para assustar quem está sob pressão.
      animate={critico && !reduzirMovimento ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
      transition={
        critico && !reduzirMovimento
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 }
      }
    >
      {/* O rótulo sai em telas estreitas; o formato hh:mm:ss já se explica. */}
      <span className="hidden text-xs font-medium uppercase tracking-wide opacity-70 sm:inline">
        Tempo
      </span>
      <IconeCronometro className="size-4 shrink-0 opacity-70" />
      <span className="font-mono text-lg font-semibold leading-none" aria-hidden="true">
        {restantes === null ? '--:--:--' : formatarTempo(restantes)}
      </span>

      {/* Anúncio discreto para leitores de tela; o texto "--:--:--" não é lido. */}
      <span className="sr-only" role="timer" aria-live="off">
        {restantes === null ? 'Carregando o tempo restante' : tempoParaLeitorDeTela(restantes)}
      </span>
    </motion.div>
  )
}
