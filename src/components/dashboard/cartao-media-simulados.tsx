'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'

import {
  IconeGraficoBarra,
  IconeGraficoLinha,
  IconeSeta,
  IconeTendencia,
} from '@/components/ui/icones'
import { botaoPrimario } from '@/components/ui/primitivos'
import { caminhoArea, caminhoSuave } from '@/lib/graficos'

const ENTRADA = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }

export type PontoMediaSimulado = { rotulo: string; nota: number }

type Visao = 'curva' | 'barra'

const LARGURA = 400
const ALTURA = 150
const PAD_X = 22
const PAD_Y_TOPO = 14
const PAD_Y_BASE = 12
const BASE_Y = ALTURA - PAD_Y_BASE

/**
 * Cartão de "Sua média nos simulados" da dashboard — recriação fiel do
 * modelo de referência (cartão de métrica com gráfico de fundo, selo de
 * tendência e rodapé de pico/vale/média), adaptado aos tokens do produto e
 * à série real disponível: uma nota por simulado finalizado (no máximo 3
 * pontos, não os ~19 do modelo). Com menos de 2 tentativas finalizadas o
 * gráfico não tem o que desenhar, então o cartão degrada para um estado sem
 * gráfico em vez de plotar uma reta ou um ponto solto.
 *
 * Exceção: um aluno com ZERO tentativas recebe, do próprio dashboard, uma
 * série de exemplo representando a tendência inicial da plataforma (prop
 * `baseline`), para o cartão nunca nascer vazio. É por isso que esse caso
 * some do componente — ele só existe aqui como fallback defensivo caso
 * algum chamador futuro passe `pontos` de fato vazio.
 */
export function CartaoMediaSimulados({
  pontos,
  mediaGeral,
  diferenca,
  totalQuestoes,
  indice = 0,
  baseline = false,
}: {
  pontos: PontoMediaSimulado[]
  mediaGeral: number | null
  /** Pontos percentuais da média pessoal acima (positivo) ou abaixo (negativo) da média da plataforma. */
  diferenca: number | null
  totalQuestoes: number
  indice?: number
  /** `pontos` é a tendência inicial da plataforma, não tentativas deste aluno
   *  — ajusta os textos para não atribuir a ele um histórico que não existe. */
  baseline?: boolean
}) {
  const reduzir = useReducedMotion()
  const idBase = useId().replace(/:/g, '')
  const [visao, setVisao] = useState<Visao>('curva')
  const [ativo, setAtivo] = useState<number | null>(null)

  const temSerie = pontos.length >= 2
  const valores = pontos.map((p) => p.nota)
  const mediaPessoal = valores.length
    ? valores.reduce((soma, v) => soma + v, 0) / valores.length
    : null

  const emAlta = diferenca !== null && diferenca > 0
  const emBaixa = diferenca !== null && diferenca < 0
  const rotuloTendencia =
    diferenca === null
      ? null
      : emAlta
        ? `+${diferenca}% acima da média`
        : emBaixa
          ? `${diferenca}% abaixo da média`
          : 'Na média da plataforma'

  const pico = valores.length ? Math.max(...valores) : null
  const vale = valores.length ? Math.min(...valores) : null
  const ultima = valores.length ? valores[valores.length - 1] : null
  const penultima = valores.length > 1 ? valores[valores.length - 2] : null
  const passo = ultima !== null && penultima !== null ? ultima - penultima : null

  const corGrafico = emBaixa ? 'var(--cor-erro)' : 'var(--cor-acerto)'

  const geometria = useMemo(() => {
    if (!temSerie) return []
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    const amplitude = (max - min || 1) * 1.3
    const passoX = (LARGURA - PAD_X * 2) / (valores.length - 1)
    const altura = ALTURA - PAD_Y_TOPO - PAD_Y_BASE
    return valores.map((v, i) => ({
      x: PAD_X + i * passoX,
      y: PAD_Y_TOPO + (1 - (v - min) / amplitude - 0.15) * altura,
    }))
  }, [valores, temSerie])

  const shell =
    'relative flex min-h-[300px] w-full flex-col overflow-hidden rounded-[28px] border ' +
    'border-borda bg-superficie shadow-[var(--sombra-2)] sm:min-h-[340px]'

  // ── Sem nenhuma tentativa finalizada: convite, sem número nem gráfico ──
  if (pontos.length === 0) {
    return (
      <motion.div
        initial={reduzir ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...ENTRADA, delay: reduzir ? 0 : indice * 0.06 }}
        className={shell}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center sm:px-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Sua média nos simulados
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-texto-suave">
            Termine seu primeiro simulado para começar a acompanhar sua evolução aqui.
          </p>
          <Link href="/simulados" className={`${botaoPrimario} mt-3`}>
            Fazer um simulado
            <IconeSeta className="size-4" />
          </Link>
        </div>
      </motion.div>
    )
  }

  // ── Uma única tentativa: o número já é real, mas uma "curva" de 1 ponto
  // não informa nada — mostrar o total e convidar a uma segunda tentativa.
  if (!temSerie) {
    return (
      <motion.div
        initial={reduzir ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...ENTRADA, delay: reduzir ? 0 : indice * 0.06 }}
        className={shell}
      >
        <div className="flex flex-1 flex-col px-6 pt-6 sm:px-8 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[17px] font-semibold tracking-tight">Sua média nos simulados</h2>
            {rotuloTendencia && (
              <SeloTendencia emAlta={emAlta} emBaixa={emBaixa} rotulo={rotuloTendencia} />
            )}
          </div>
          <div className="mt-5 font-display text-[56px] font-semibold leading-none tracking-tight">
            {Math.round(mediaPessoal ?? 0)}
            <span className="text-lg text-texto-fraco">/{totalQuestoes}</span>
          </div>
        </div>
        <div className="mt-auto border-t border-borda px-6 py-4 text-sm text-texto-suave sm:px-8">
          Faça outro simulado para ver sua evolução ao longo do tempo.
        </div>
      </motion.div>
    )
  }

  const linhaD = caminhoSuave(geometria)
  const areaD = caminhoArea(geometria, BASE_Y)
  const largurasBarra = Math.min(36, (LARGURA - PAD_X * 2) / geometria.length / 1.8)
  const pontoAtivo = ativo !== null ? geometria[ativo] : null

  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTRADA, delay: reduzir ? 0 : indice * 0.06 }}
      className={shell}
    >
      {/* Região do gráfico, atrás do conteúdo, sangrando pela direita */}
      <div className="absolute inset-y-0 right-0 z-0 w-[62%]">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to left, ${corGrafico}14, transparent 75%)` }}
        />
        <div
          className="absolute inset-0 text-texto-fraco/[0.5]"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 55%)',
            maskImage: 'linear-gradient(to right, transparent, black 55%)',
          }}
        >
          <svg className="h-full w-full" aria-hidden="true">
            <defs>
              <pattern id={`grade-${idBase}`} width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grade-${idBase})`} />
          </svg>
        </div>

        <svg
          className="h-full w-full"
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Evolução da nota: ${pontos.map((p) => `${p.rotulo} ${p.nota}`).join(', ')}`}
        >
          <defs>
            <linearGradient id={`preenchimento-${idBase}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corGrafico} stopOpacity="0.24" />
              <stop offset="100%" stopColor={corGrafico} stopOpacity="0" />
            </linearGradient>
          </defs>

          {visao === 'curva' ? (
            <>
              <path d={areaD} fill={`url(#preenchimento-${idBase})`} stroke="none" />
              <path
                d={linhaD}
                fill="none"
                stroke={corGrafico}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            geometria.map((p, i) => (
              <rect
                key={i}
                x={p.x - largurasBarra / 2}
                y={p.y}
                width={largurasBarra}
                height={Math.max(2, BASE_Y - p.y)}
                rx={largurasBarra / 3}
                fill={corGrafico}
                fillOpacity={ativo === null || ativo === i ? 0.85 : 0.4}
              />
            ))
          )}

          {geometria.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={visao === 'curva' ? p.y : BASE_Y}
              r={14}
              fill="transparent"
              className="cursor-pointer outline-none"
              tabIndex={0}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            />
          ))}

          {pontoAtivo && visao === 'curva' && (
            <circle
              cx={pontoAtivo.x}
              cy={pontoAtivo.y}
              r={4.5}
              fill={corGrafico}
              stroke="var(--cor-superficie)"
              strokeWidth={2}
            />
          )}
        </svg>

        {ativo !== null && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)]
                       whitespace-nowrap rounded-lg border border-borda bg-superficie px-2.5 py-1.5
                       text-xs shadow-[var(--sombra-2)]"
            style={{
              left: `${(geometria[ativo].x / LARGURA) * 100}%`,
              top: `${(geometria[ativo].y / ALTURA) * 100}%`,
            }}
          >
            <p className="font-medium text-texto">{pontos[ativo].rotulo}</p>
            <p className="tabular-nums text-texto-suave">
              {pontos[ativo].nota}/{totalQuestoes}
            </p>
          </div>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col px-6 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center justify-between gap-4">
          <div className="pointer-events-auto flex items-center gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight">
              {baseline ? 'Média da plataforma' : 'Sua média nos simulados'}
            </h2>
            <div className="flex items-center rounded-lg border border-borda bg-superficie p-0.5">
              <button
                type="button"
                onClick={() => setVisao('curva')}
                aria-pressed={visao === 'curva'}
                aria-label="Ver como linha"
                className={`flex size-7 items-center justify-center rounded-md transition-colors duration-200 ${
                  visao === 'curva'
                    ? 'bg-superficie-2 text-texto shadow-[var(--sombra-1)]'
                    : 'text-texto-fraco hover:text-texto-suave'
                }`}
              >
                <IconeGraficoLinha className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setVisao('barra')}
                aria-pressed={visao === 'barra'}
                aria-label="Ver como barras"
                className={`flex size-7 items-center justify-center rounded-md transition-colors duration-200 ${
                  visao === 'barra'
                    ? 'bg-superficie-2 text-texto shadow-[var(--sombra-1)]'
                    : 'text-texto-fraco hover:text-texto-suave'
                }`}
              >
                <IconeGraficoBarra className="size-4" />
              </button>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-3 text-sm">
            {rotuloTendencia && (
              <SeloTendencia emAlta={emAlta} emBaixa={emBaixa} rotulo={rotuloTendencia} />
            )}
            <span className="hidden text-texto-fraco sm:inline">
              {baseline
                ? 'Base inicial'
                : pontos.length === 3
                  ? 'Simulados 1–3'
                  : `${pontos.length} tentativas`}
            </span>
          </div>
        </div>

        <div className="mt-5 font-display text-[46px] font-semibold leading-none tracking-tight sm:text-[64px]">
          {Math.round(mediaPessoal ?? 0)}
          <span className="text-lg text-texto-fraco">/{totalQuestoes}</span>
        </div>
      </div>

      {/* Rodapé opaco: passo desde a última tentativa + pico/vale/média */}
      <div
        className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1
                   border-t border-borda bg-superficie px-6 py-3 text-sm sm:px-8 sm:py-4"
      >
        <div>
          {baseline ? (
            <span className="text-texto-fraco">
              Assim que você terminar seu primeiro simulado, este gráfico passa a ser o seu.
            </span>
          ) : passo !== null ? (
            <>
              <span
                className="font-medium"
                style={{ color: passo >= 0 ? 'var(--cor-acerto)' : 'var(--cor-erro)' }}
              >
                {passo >= 0 ? '+' : ''}
                {passo}
              </span>{' '}
              <span className="text-texto-fraco">desde a tentativa anterior</span>
            </>
          ) : (
            <span className="text-texto-fraco">
              Média da plataforma {mediaGeral === null ? '—' : `${Math.round(mediaGeral)}/${totalQuestoes}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-xs text-texto-fraco">
          <span>
            <span className="font-medium text-texto/80">{pico}</span> pico
          </span>
          <span className="opacity-40">·</span>
          <span>
            <span className="font-medium text-texto/80">{vale}</span> vale
          </span>
          <span className="opacity-40">·</span>
          <span>
            <span className="font-medium text-texto/80">{Math.round(mediaPessoal ?? 0)}</span> média
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function SeloTendencia({
  emAlta,
  emBaixa,
  rotulo,
}: {
  emAlta: boolean
  emBaixa: boolean
  rotulo: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs
                  font-semibold tabular-nums ${
                    emAlta
                      ? 'bg-acerto-suave text-acerto'
                      : emBaixa
                        ? 'bg-erro-suave text-erro'
                        : 'bg-superficie-2 text-texto-suave'
                  }`}
    >
      {(emAlta || emBaixa) && (
        <IconeTendencia direcao={emAlta ? 'alta' : 'baixa'} className="size-3.5" />
      )}
      {rotulo}
    </span>
  )
}
