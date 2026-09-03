'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

/**
 * Primitivos visuais do produto.
 *
 * Timing unificado: 0.5s com a curva [0.22, 1, 0.36, 1] para entradas e
 * 200ms para reação a hover/foco. O movimento entra só uma vez, na chegada do
 * dado — não há nada em laço, porque animação contínua compete com um aluno
 * que está tentando ler enunciado clínico.
 */
const ENTRADA = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }

export function Cartao({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-borda bg-superficie shadow-[var(--sombra-1)] ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Cartão de métrica. Sobe e aparece na montagem, com atraso escalonado pelo
 * índice para a linha de cartões chegar em cascata em vez de piscar junta.
 */
export function CartaoMetrica({
  titulo,
  valor,
  legenda,
  href,
  indice = 0,
  icone,
  destaque = false,
}: {
  titulo: string
  valor: string
  legenda: string
  href?: string
  indice?: number
  /** Elemento já renderizado: um Server Component não pode passar a *função*
   *  do componente para cá, mas pode passar o elemento. */
  icone?: React.ReactNode
  destaque?: boolean
}) {
  const reduzir = useReducedMotion()

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-texto-suave">{titulo}</h2>
        {icone && (
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
              destaque ? 'bg-acento text-acento-texto' : 'bg-superficie-2 text-texto-suave'
            }`}
          >
            {icone}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight">
        {valor}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-texto-fraco">{legenda}</p>
    </>
  )

  const classe =
    'block rounded-2xl border border-borda bg-superficie p-5 shadow-[var(--sombra-1)] transition-[box-shadow,border-color] duration-200'

  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTRADA, delay: reduzir ? 0 : indice * 0.06 }}
    >
      {href ? (
        // Hover muda sombra e borda, nunca escala: transformar o cartão
        // desloca o que está ao redor e faz a grade "respirar" sem motivo.
        <Link
          href={href}
          className={`${classe} cursor-pointer hover:border-borda-forte hover:shadow-[var(--sombra-2)]`}
        >
          {conteudo}
        </Link>
      ) : (
        <div className={classe}>{conteudo}</div>
      )}
    </motion.div>
  )
}

/**
 * Barra de desempenho por área. O preenchimento cresce da esquerda na entrada,
 * o que dá ao aluno a leitura de "quanto" antes mesmo de ele ler o número.
 */
export function BarraArea({
  area,
  acertos,
  total,
  percentual,
  detalhe,
  indice = 0,
}: {
  area: string
  acertos: number
  total: number
  percentual: number
  detalhe?: string
  indice?: number
}) {
  const reduzir = useReducedMotion()
  const cor =
    percentual < 50 ? 'bg-erro' : percentual < 70 ? 'bg-alerta' : 'bg-acerto'

  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{area}</span>
        <span className="font-display text-sm tabular-nums text-texto-suave">
          {acertos}/{total} · <span className="font-semibold text-texto">{percentual}%</span>
        </span>
      </div>

      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-superficie-2"
        role="img"
        aria-label={`${area}: ${acertos} de ${total} questões, ${percentual} por cento`}
      >
        <motion.div
          className={`h-full rounded-full ${cor}`}
          initial={reduzir ? false : { width: 0 }}
          animate={{ width: `${Math.max(percentual, 2)}%` }}
          transition={{ ...ENTRADA, delay: reduzir ? 0 : 0.1 + indice * 0.07 }}
        />
      </div>

      {detalhe && <p className="mt-1 text-xs tabular-nums text-texto-fraco">{detalhe}</p>}
    </li>
  )
}

/**
 * Anel de progresso circular (SVG). Primitivo novo — nada no projeto ainda
 * precisava de progresso circular; as barras (`BarraArea`) bastavam até aqui.
 *
 * `null` em `percentual` é um estado distinto de 0%: representa "ainda não há
 * nada para medir" (ex.: banco de questões vazio), e o anel fica cinza e vazio
 * em vez de sugerir "0% de progresso" sobre um total que nem existe.
 */
export function AnelProgresso({
  percentual,
  tamanho = 96,
  espessura = 9,
  rotulo,
  valorCentral,
}: {
  percentual: number | null
  tamanho?: number
  espessura?: number
  rotulo: string
  valorCentral: string
}) {
  const reduzir = useReducedMotion()
  const raio = (tamanho - espessura) / 2
  const perimetro = 2 * Math.PI * raio
  const fracao = Math.min(100, Math.max(0, percentual ?? 0)) / 100

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: tamanho, height: tamanho }}>
        <svg
          width={tamanho}
          height={tamanho}
          viewBox={`0 0 ${tamanho} ${tamanho}`}
          className="-rotate-90"
          role="img"
          aria-label={`${rotulo}: ${percentual === null ? 'sem dados ainda' : `${percentual}%`}`}
        >
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            stroke="var(--cor-superficie-2)"
            strokeWidth={espessura}
          />
          {percentual !== null && (
            <motion.circle
              cx={tamanho / 2}
              cy={tamanho / 2}
              r={raio}
              fill="none"
              stroke="var(--cor-acento)"
              strokeWidth={espessura}
              strokeLinecap="round"
              strokeDasharray={perimetro}
              initial={reduzir ? false : { strokeDashoffset: perimetro }}
              animate={{ strokeDashoffset: perimetro * (1 - fracao) }}
              transition={{ ...ENTRADA, delay: reduzir ? 0 : 0.1 }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-lg font-semibold tabular-nums tracking-tight">
            {valorCentral}
          </span>
        </div>
      </div>
      <p className="text-center text-xs leading-snug text-texto-fraco">{rotulo}</p>
    </div>
  )
}

/**
 * Cartão de contraste: fundo escuro fixo (não acompanha o tema claro/escuro do
 * app) para 2-3 blocos de destaque por tela — nunca a maioria. Usa os tokens
 * `contraste-*`, que são os mesmos valores do nosso modo escuro, fixos.
 */
export function CartaoContraste({
  children,
  indice = 0,
}: {
  children: React.ReactNode
  indice?: number
}) {
  const reduzir = useReducedMotion()

  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTRADA, delay: reduzir ? 0 : indice * 0.06 }}
      className="flex flex-col rounded-2xl border border-contraste-borda bg-contraste-fundo
                 p-5 text-contraste-texto shadow-[var(--sombra-2)]"
    >
      {children}
    </motion.div>
  )
}

/** Título de seção com espaçamento e hierarquia consistentes. */
export function TituloSecao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{titulo}</h2>
        {descricao && <p className="mt-1 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

/**
 * Estado vazio. Recebe ícone SVG, nunca emoji, e sempre oferece uma saída —
 * um estado vazio sem próximo passo é um beco.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acoes,
}: {
  icone: React.ReactNode
  titulo: string
  descricao: string
  acoes?: React.ReactNode
}) {
  const reduzir = useReducedMotion()

  return (
    <motion.div
      initial={reduzir ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ENTRADA}
      className="rounded-2xl border border-borda bg-superficie px-6 py-14 text-center
                 shadow-[var(--sombra-1)]"
    >
      <span
        aria-hidden="true"
        className="mx-auto flex size-14 items-center justify-center rounded-2xl
                   bg-acento-suave text-acento"
      >
        {icone}
      </span>
      <h2 className="mt-5 font-display text-lg font-semibold tracking-tight">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-texto-suave">
        {descricao}
      </p>
      {acoes && <div className="mt-6 flex flex-wrap justify-center gap-3">{acoes}</div>}
    </motion.div>
  )
}

/** Botões com aparência unificada, para não haver dois "primários" diferentes. */
export const botaoPrimario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-acento px-4 py-2.5 ' +
  'text-sm font-medium text-acento-texto shadow-[var(--sombra-acento)] transition-colors duration-200 ' +
  'hover:bg-acento-forte disabled:cursor-not-allowed disabled:opacity-60'

export const botaoSecundario =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-borda ' +
  'bg-superficie px-4 py-2.5 text-sm font-medium text-texto transition-colors duration-200 ' +
  'hover:border-borda-forte hover:bg-superficie-2 disabled:cursor-not-allowed disabled:opacity-60'
