'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { Alternativa } from '@/lib/simulado'

export type ResultadoResposta =
  | {
      ok: true
      acertou: boolean
      respostaCorreta: Alternativa
      comentarioCorreta: string | null
      comentarioErros: string | null
    }
  | { ok: false; motivo: string }

/**
 * Registra a resposta e devolve a correção na mesma ida ao servidor.
 *
 * O aluno não consegue ler `resposta_correta` (privilégio de coluna), então a
 * comparação é feita no Postgres: é o que permite o feedback imediato do banco
 * sem nunca expor o gabarito antes da resposta — ao contrário do Modo Prova,
 * onde nada é revelado até finalizar.
 */
export async function responderBanco(
  questaoId: string,
  alternativa: Alternativa,
): Promise<ResultadoResposta> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('responder_banco', {
    p_questao_id: questaoId,
    p_alternativa: alternativa,
  })

  if (error) return { ok: false, motivo: 'Não foi possível registrar sua resposta.' }

  const linha = Array.isArray(data) ? data[0] : data
  if (!linha) return { ok: false, motivo: 'Resposta não registrada.' }

  revalidatePath('/banco')
  revalidatePath('/cadernos')

  return {
    ok: true,
    acertou: linha.acertou,
    respostaCorreta: linha.resposta_correta as Alternativa,
    comentarioCorreta: linha.comentario_correta,
    comentarioErros: linha.comentario_erros,
  }
}

/**
 * Marca/desmarca favorito. Vale mesmo antes de responder — por isso a view
 * `gabaritos_liberados` exige uma alternativa escolhida, e não só a existência
 * da linha: caso contrário favoritar revelaria a resposta.
 */
export async function alternarFavorito(
  questaoId: string,
  favorito: boolean,
): Promise<{ ok: boolean; motivo?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, motivo: 'Sessão expirada.' }

  const { error } = await supabase.from('respostas_banco').upsert(
    { usuario_id: user.id, questao_id: questaoId, favorito },
    { onConflict: 'usuario_id,questao_id' },
  )

  if (error) return { ok: false, motivo: 'Não foi possível favoritar a questão.' }

  revalidatePath('/banco')
  return { ok: true }
}
