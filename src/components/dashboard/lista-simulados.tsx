'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

import { IconeSeta } from '@/components/ui/icones'
import { TOTAL_QUESTOES } from '@/lib/simulado'

export type LinhaSimulado = {
  numero: number
  disponivel: boolean
  status: 'nao_iniciado' | 'em_andamento' | 'finalizado'
  melhorNota: number | null
}

const RUBRICA_STATUS: Record<LinhaSimulado['status'], { texto: string; classe: string }> = {
  nao_iniciado: { texto: 'Não iniciado', classe: 'bg-superficie-2 text-texto-suave' },
  em_andamento: { texto: 'Em andamento', classe: 'bg-alerta-suave text-alerta' },
  finalizado: { texto: 'Concluído', classe: 'bg-acerto-suave text-acerto' },
}

/**
 * Versão compacta e tabular dos simulados, só para a Dashboard — o grid de
 * cards completo (com o modal de regras) continua em /simulados. Aqui o
 * objetivo é dar o retrato dos 3 de uma olhada, não repetir a ação de iniciar.
 */
export function ListaSimulados({ linhas }: { linhas: LinhaSimulado[] }) {
  const reduzir = useReducedMotion()

  return (
    <ul className="flex flex-col divide-y divide-borda">
      {linhas.map((linha, i) => {
        const rubrica = !linha.disponivel
          ? { texto: 'Em produção', classe: 'bg-superficie-2 text-texto-fraco' }
          : RUBRICA_STATUS[linha.status]

        const href =
          linha.status === 'em_andamento'
            ? `/simulados/${linha.numero}/prova`
            : '/simulados'

        return (
          <motion.li
            key={linha.numero}
            initial={reduzir ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: reduzir ? 0 : i * 0.06 }}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 py-3.5 first:pt-0 last:pb-0"
          >
            <span className="font-display text-sm font-semibold tabular-nums text-texto-fraco">
              {String(linha.numero).padStart(2, '0')}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Simulado {linha.numero}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs ${rubrica.classe}`}>
                {rubrica.texto}
              </span>
            </div>

            <span className="hidden text-sm tabular-nums text-texto-suave sm:block">
              {linha.melhorNota !== null ? (
                <>
                  {linha.melhorNota}
                  <span className="text-texto-fraco">/{TOTAL_QUESTOES}</span>
                </>
              ) : (
                <span className="text-texto-fraco">—</span>
              )}
            </span>

            {linha.disponivel ? (
              <Link
                href={href}
                aria-label={
                  linha.status === 'em_andamento'
                    ? `Continuar Simulado ${linha.numero}`
                    : `Ir para o Simulado ${linha.numero}`
                }
                className="flex size-8 shrink-0 items-center justify-center rounded-full
                           border border-borda text-texto-suave transition-colors
                           hover:border-acento hover:text-acento"
              >
                <IconeSeta className="size-4" />
              </Link>
            ) : (
              <span className="size-8" aria-hidden="true" />
            )}
          </motion.li>
        )
      })}
    </ul>
  )
}
