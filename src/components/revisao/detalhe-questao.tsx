import { ALTERNATIVAS, type Alternativa } from '@/lib/simulado'

const CAMPO_ALTERNATIVA = {
  A: 'alternativa_a',
  B: 'alternativa_b',
  C: 'alternativa_c',
  D: 'alternativa_d',
} as const

export type AlternativasQuestao = {
  alternativa_a: string
  alternativa_b: string
  alternativa_c: string
  alternativa_d: string
}

/**
 * Alternativas + comentários de uma questão já corrigida: verde na correta,
 * vermelho na marcada quando ela está errada, neutro nas demais. Usado tanto
 * no Caderno de Erros quanto no Gabarito do simulado — mesma peça visual nos
 * dois lugares, para "resposta marcada / resposta correta / explicação"
 * nunca divergir de aparência entre as duas telas.
 */
export function DetalheQuestao({
  questao,
  respostaCorreta,
  respostaEscolhida,
  comentarioCorreta,
  comentarioErros,
}: {
  questao: AlternativasQuestao
  respostaCorreta: Alternativa | null
  /** null = a questão ficou em branco. */
  respostaEscolhida: Alternativa | null
  comentarioCorreta?: string | null
  comentarioErros?: string | null
}) {
  return (
    <>
      <ul className="mt-4 flex flex-col gap-1.5">
        {ALTERNATIVAS.map((letra) => {
          const texto = questao[CAMPO_ALTERNATIVA[letra]]
          const ehCorreta = respostaCorreta === letra
          const ehEscolhidaErrada = respostaEscolhida === letra && !ehCorreta

          return (
            <li
              key={letra}
              className={`flex gap-2.5 rounded-lg px-3 py-2 text-sm ${
                ehCorreta
                  ? 'bg-acerto-suave text-acerto'
                  : ehEscolhidaErrada
                    ? 'bg-erro-suave text-erro'
                    : 'text-texto-suave'
              }`}
            >
              <span className="font-semibold">{letra}</span>
              <span className="leading-relaxed">{texto}</span>
              {ehEscolhidaErrada && (
                <span className="ml-auto shrink-0 text-xs font-medium">Sua resposta</span>
              )}
            </li>
          )
        })}
      </ul>

      {respostaEscolhida === null && (
        <p className="mt-2 text-xs text-texto-fraco">Você não respondeu esta questão.</p>
      )}

      {comentarioCorreta && (
        <p className="mt-4 border-l-2 border-acento pl-3 text-sm leading-relaxed">
          {comentarioCorreta}
        </p>
      )}
      {comentarioErros && (
        <p className="mt-2 pl-3 text-sm leading-relaxed text-texto-suave">{comentarioErros}</p>
      )}
    </>
  )
}
