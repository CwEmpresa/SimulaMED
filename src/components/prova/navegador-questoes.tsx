'use client'

export type SituacaoQuestao = {
  respondida: boolean
  revisao: boolean
}

type Props = {
  situacoes: SituacaoQuestao[]
  indiceAtual: number
  aoEscolher: (indice: number) => void
}

/**
 * Grade das 100 questões. É o mapa mental da prova: em uma olhada o aluno
 * precisa saber onde está, o que já respondeu e o que deixou marcado.
 *
 * "Atual" é um anel por cima do estado, não um estado próprio — senão a questão
 * em que o aluno está pareceria não respondida, e a contagem mentiria.
 *
 * O estado não é comunicado só por cor: a borda e o rótulo de leitor de tela
 * carregam a mesma informação para quem não distingue as cores.
 */
export function NavegadorQuestoes({ situacoes, indiceAtual, aoEscolher }: Props) {
  const respondidas = situacoes.filter((s) => s.respondida).length
  const marcadas = situacoes.filter((s) => s.revisao).length

  return (
    <nav
      aria-label="Navegador de questões"
      className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4
                 shadow-[var(--sombra-1)]"
    >
      <div className="flex items-center justify-between text-xs text-texto-suave">
        <span>
          <span className="tabular-nums">{respondidas}</span> de {situacoes.length} respondidas
        </span>
        {marcadas > 0 && (
          <span className="text-alerta tabular-nums">{marcadas} para revisar</span>
        )}
      </div>

      <ol className="grid grid-cols-10 gap-1.5">
        {situacoes.map((situacao, i) => {
          const atual = i === indiceAtual
          const base = situacao.revisao
            ? 'bg-alerta-suave text-alerta border border-alerta/50'
            : situacao.respondida
              ? 'bg-acento/15 text-acento border border-acento/40'
              : 'bg-superficie-2 text-texto-suave border border-borda'
          const anel = atual
            ? ' ring-2 ring-acento ring-offset-2 ring-offset-fundo font-bold'
            : ''

          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => aoEscolher(i)}
                aria-current={atual ? 'true' : undefined}
                aria-label={rotulo(i, situacao, atual)}
                className={`aspect-square w-full cursor-pointer rounded-md text-xs font-medium tabular-nums
                            transition-colors ${base}${anel}`}
              >
                {i + 1}
              </button>
            </li>
          )
        })}
      </ol>

      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-texto-fraco">
        <Legenda cor="bg-acento/15 border border-acento/40" texto="Respondida" />
        <Legenda cor="bg-alerta-suave border border-alerta/50" texto="Para revisar" />
        <Legenda cor="bg-superficie-2 border border-borda" texto="Em branco" />
        <Legenda cor="bg-superficie-2 border border-borda ring-2 ring-acento" texto="Atual" />
      </dl>
    </nav>
  )
}

function rotulo(indice: number, situacao: SituacaoQuestao, atual: boolean) {
  const partes = [`Questão ${indice + 1}`]
  partes.push(situacao.respondida ? 'respondida' : 'em branco')
  if (situacao.revisao) partes.push('marcada para revisão')
  if (atual) partes.push('questão atual')
  return partes.join(', ')
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded ${cor}`} />
      <span>{texto}</span>
    </div>
  )
}
