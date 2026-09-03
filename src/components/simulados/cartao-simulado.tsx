'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'

import { iniciarSimulado } from '@/app/actions/simulado'
import { IconeCronometro, IconeEmProducao, IconeSeta } from '@/components/ui/icones'
import { botaoPrimario, botaoSecundario } from '@/components/ui/primitivos'
import { TOTAL_QUESTOES } from '@/lib/simulado'

type Props = {
  numero: number
  totalQuestoes: number
  emAndamento: boolean
  melhorNota: number | null
  indice?: number
}

export function CartaoSimulado({
  numero,
  totalQuestoes,
  emAndamento,
  melhorNota,
  indice = 0,
}: Props) {
  const [mostrandoRegras, setMostrandoRegras] = useState(false)
  const reduzir = useReducedMotion()
  const disponivel = totalQuestoes > 0

  const status = !disponivel
    ? { texto: 'Em produção', classe: 'bg-superficie-2 text-texto-fraco' }
    : emAndamento
      ? { texto: 'Em andamento', classe: 'bg-alerta-suave text-alerta' }
      : melhorNota !== null
        ? { texto: 'Concluído', classe: 'bg-acerto-suave text-acerto' }
        : { texto: 'Não iniciado', classe: 'bg-superficie-2 text-texto-suave' }

  return (
    <>
      <motion.article
        initial={reduzir ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: reduzir ? 0 : indice * 0.08 }}
        className={`flex flex-col rounded-2xl border bg-superficie p-6 shadow-[var(--sombra-1)]
                    ${emAndamento ? 'border-alerta/40' : 'border-borda'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-texto-fraco">
              {String(numero).padStart(2, '0')}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
              Simulado {numero}
            </h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.classe}`}>
            {status.texto}
          </span>
        </div>

        {disponivel ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-texto-suave">
            <IconeCronometro className="size-4 shrink-0" />
            {totalQuestoes} questões · 5 horas
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-texto-suave">
            <IconeEmProducao className="mt-0.5 size-4 shrink-0" />
            As questões deste simulado ainda estão sendo produzidas.
          </p>
        )}

        {melhorNota !== null && (
          <div className="mt-5 rounded-xl bg-superficie-2 px-4 py-3">
            <p className="text-xs text-texto-fraco">Melhor nota</p>
            <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">
              {melhorNota}
              <span className="text-base text-texto-fraco">/{TOTAL_QUESTOES}</span>
            </p>
          </div>
        )}

        <div className="mt-auto pt-6">
          {!disponivel ? (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-borda px-4 py-2.5
                         text-sm text-texto-fraco"
            >
              Em breve
            </button>
          ) : emAndamento ? (
            <Link
              href={`/simulados/${numero}/prova`}
              className={`${botaoPrimario} w-full bg-alerta shadow-none hover:bg-alerta`}
            >
              Continuar prova
              <IconeSeta className="size-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setMostrandoRegras(true)}
              className={`${botaoPrimario} w-full`}
            >
              {melhorNota !== null ? 'Refazer simulado' : 'Iniciar simulado'}
              <IconeSeta className="size-4" />
            </button>
          )}
        </div>
      </motion.article>

      {mostrandoRegras && (
        <ModalRegras
          numero={numero}
          totalQuestoes={totalQuestoes}
          aoCancelar={() => setMostrandoRegras(false)}
        />
      )}
    </>
  )
}

/**
 * Regras da prova. A confirmação é explícita porque iniciar dispara o
 * cronômetro de 5 horas no servidor — não há como pausar depois.
 */
function ModalRegras({
  numero,
  totalQuestoes,
  aoCancelar,
}: {
  numero: number
  totalQuestoes: number
  aoCancelar: () => void
}) {
  const [iniciando, iniciar] = useTransition()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const reduzir = useReducedMotion()

  useEffect(() => {
    botaoRef.current?.focus()
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoCancelar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoCancelar])

  const REGRAS = [
    <>
      <strong className="text-texto">{totalQuestoes} questões</strong> em{' '}
      <strong className="text-texto">5 horas</strong>, como na prova real.
    </>,
    <>
      <strong className="text-texto">Sem pausa.</strong> O cronômetro corre mesmo se você fechar
      a aba.
    </>,
    <>Suas respostas são salvas a cada clique — se a página cair, você volta de onde parou.</>,
    <>
      Ao acabar o tempo, a prova é{' '}
      <strong className="text-texto">enviada automaticamente</strong>.
    </>,
    <>Você não verá se acertou até finalizar.</>,
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1119]/60 p-4
                 backdrop-blur-sm"
      onClick={aoCancelar}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-regras"
        onClick={(e) => e.stopPropagation()}
        initial={reduzir ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border border-borda bg-superficie p-6
                   shadow-[var(--sombra-3)]"
      >
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-acento-suave text-acento"
        >
          <IconeCronometro className="size-6" />
        </span>

        <h2 id="titulo-regras" className="mt-4 font-display text-xl font-semibold tracking-tight">
          Antes de começar o Simulado {numero}
        </h2>

        <ul className="mt-4 flex flex-col gap-2.5">
          {REGRAS.map((regra, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-texto-suave">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-acento" />
              <span>{regra}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-3">
          <button ref={botaoRef} type="button" onClick={aoCancelar} className={`${botaoSecundario} flex-1`}>
            Agora não
          </button>
          <button
            type="button"
            disabled={iniciando}
            onClick={() => iniciar(() => void iniciarSimulado(numero))}
            className={`${botaoPrimario} flex-1`}
          >
            {iniciando ? 'Iniciando...' : 'Começar agora'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
