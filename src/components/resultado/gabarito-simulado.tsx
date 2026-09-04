'use client'

import { useState } from 'react'

import { ApoioQuestao } from '@/components/questao/apoio-questao'
import { DetalheQuestao, type AlternativasQuestao } from '@/components/revisao/detalhe-questao'
import type { Alternativa, ImagemApoio, TabelaDados } from '@/lib/simulado'

export type QuestaoGabarito = AlternativasQuestao & {
  id: string
  numero_na_prova: number
  area: string
  subtema: string | null
  enunciado: string
  tabela_dados: TabelaDados | null
  grafico_svg: string | null
  imagens: ImagemApoio[] | null
  resposta_correta: Alternativa
  comentario_correta: string | null
  comentario_erros: string | null
  respostaEscolhida: Alternativa | null
}

type Situacao = 'acerto' | 'erro' | 'em_branco'

function situacaoDe(q: QuestaoGabarito): Situacao {
  if (q.respostaEscolhida === null) return 'em_branco'
  return q.respostaEscolhida === q.resposta_correta ? 'acerto' : 'erro'
}

const ESTILO_GRADE: Record<Situacao, string> = {
  acerto: 'bg-acerto/15 text-acerto border border-acerto/40',
  erro: 'bg-erro/15 text-erro border border-erro/40',
  em_branco: 'bg-superficie-2 text-texto-suave border border-borda',
}

const ROTULO: Record<Situacao, string> = {
  acerto: 'acertou',
  erro: 'errou',
  em_branco: 'não respondida',
}

/**
 * Grade de 100 questões coloridas por resultado (verde/vermelho/cinza) + o
 * detalhe da questão selecionada abaixo. Mesma divisão grade+detalhe do Modo
 * Prova (`TelaProva`/`NavegadorQuestoes`), porque é o padrão visual que o
 * aluno já reconhece — só as cores mudam de significado (aqui é resultado,
 * lá era progresso).
 */
export function GabaritoSimulado({ questoes }: { questoes: QuestaoGabarito[] }) {
  const [indice, setIndice] = useState(0)
  const atual = questoes[indice]

  const total = questoes.length
  const acertos = questoes.filter((q) => situacaoDe(q) === 'acerto').length
  const erros = questoes.filter((q) => situacaoDe(q) === 'erro').length
  const brancos = total - acertos - erros

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <article className="rounded-2xl border border-borda bg-superficie p-5 shadow-[var(--sombra-1)] sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">
            Questão {atual.numero_na_prova}
          </span>
          <span className="rounded bg-superficie-2 px-2 py-0.5 font-medium">{atual.area}</span>
          {atual.subtema && <span>{atual.subtema}</span>}
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${ESTILO_GRADE[situacaoDe(atual)]}`}
          >
            {ROTULO[situacaoDe(atual)]}
          </span>
        </div>

        <h1 className="mt-4 text-[15px] leading-relaxed sm:text-lg">{atual.enunciado}</h1>

        <ApoioQuestao
          tabelaDados={atual.tabela_dados}
          graficoSvg={atual.grafico_svg}
          imagens={atual.imagens}
        />

        <DetalheQuestao
          questao={atual}
          respostaCorreta={atual.resposta_correta}
          respostaEscolhida={atual.respostaEscolhida}
          comentarioCorreta={atual.comentario_correta}
          comentarioErros={atual.comentario_erros}
        />

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            disabled={indice === 0}
            className="rounded-xl border border-borda px-4 py-2 text-sm transition-colors
                       hover:border-borda-forte hover:bg-superficie-2 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setIndice((i) => Math.min(questoes.length - 1, i + 1))}
            disabled={indice === questoes.length - 1}
            className="rounded-xl bg-acento px-4 py-2 text-sm font-medium text-acento-texto
                       transition-colors hover:bg-acento-forte disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </article>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <nav
          aria-label="Gabarito das 100 questões"
          className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4
                     shadow-[var(--sombra-1)]"
        >
          <div className="flex items-center justify-between text-xs text-texto-suave">
            <span className="text-acerto">{acertos} certas</span>
            <span className="text-erro">{erros} erradas</span>
            <span>{brancos} em branco</span>
          </div>

          <ol className="grid grid-cols-10 gap-1.5">
            {questoes.map((q, i) => {
              const situacao = situacaoDe(q)
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setIndice(i)}
                    aria-current={i === indice ? 'true' : undefined}
                    aria-label={`Questão ${q.numero_na_prova}, ${ROTULO[situacao]}`}
                    className={`aspect-square w-full cursor-pointer rounded-md text-xs font-medium
                                tabular-nums transition-colors ${ESTILO_GRADE[situacao]} ${
                                  i === indice
                                    ? 'ring-2 ring-acento ring-offset-2 ring-offset-superficie'
                                    : ''
                                }`}
                  >
                    {q.numero_na_prova}
                  </button>
                </li>
              )
            })}
          </ol>

          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-texto-fraco">
            <Legenda cor="bg-acerto/15 border border-acerto/40" texto="Acertou" />
            <Legenda cor="bg-erro/15 border border-erro/40" texto="Errou" />
            <Legenda cor="bg-superficie-2 border border-borda" texto="Não respondida" />
          </dl>
        </nav>
      </aside>
    </div>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded ${cor}`} />
      <span>{texto}</span>
    </div>
  )
}
