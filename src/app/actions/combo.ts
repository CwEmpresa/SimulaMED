'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Registra o combo da sessão que acabou de terminar (errou ou estourou o
 * tempo) e devolve o recorde já atualizado.
 *
 * `registrar_recorde_combo` é SECURITY DEFINER e faz `greatest(recorde_combo,
 * p_combo)` no servidor — o cliente nunca escreve o valor final diretamente
 * (a coluna nem tem grant de UPDATE para `authenticated`), então não dá para
 * forjar um recorde maior manipulando o estado da página.
 *
 * Sem `revalidatePath` de propósito: esta função é chamada de dentro de um
 * setInterval/setTimeout do jogo, não de um clique direto, e invalidar a
 * rota nesse contexto disparava "Cannot update a component (Router) while
 * rendering a different component" — o refresh do App Router colidindo com
 * o próprio re-render do jogo. Também é desnecessário: a tela de fim já
 * reflete o recorde pelo estado local (`setRecorde`), e tanto /combo quanto
 * /dashboard buscam o valor fresco do banco a cada nova visita, sem cache.
 */
export async function registrarRecordeCombo(
  combo: number,
): Promise<{ ok: true; recorde: number } | { ok: false; motivo: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('registrar_recorde_combo', { p_combo: combo })
  if (error) return { ok: false, motivo: 'Não foi possível salvar seu combo.' }

  return { ok: true, recorde: data }
}
