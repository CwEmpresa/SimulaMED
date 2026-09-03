'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { DURACAO_PROVA_SEGUNDOS, type Alternativa } from '@/lib/simulado'

/** Erro esperado de regra de negócio (prova acabada, sem permissão, etc.). */
type Resultado = { ok: true } | { ok: false; motivo: string }

/**
 * Discriminante literal (`ok`) em vez de checar a presença de uma chave: o
 * TypeScript normaliza uniões com propriedades opcionais, e `'erro' in ctx`
 * deixaria os dois ramos vivos, tipando o erro como `string | undefined`.
 */
async function tentativaEditavel(tentativaId: string) {
  const supabase = await createClient()

  // O RLS já garante que só a própria tentativa é visível.
  const { data: tentativa, error } = await supabase
    .from('tentativas_simulado')
    .select('id, iniciado_em, status')
    .eq('id', tentativaId)
    .single()

  if (error || !tentativa) {
    return { ok: false as const, motivo: 'Tentativa não encontrada.' }
  }
  if (tentativa.status === 'finalizado') {
    return { ok: false as const, motivo: 'Esta prova já foi finalizada.' }
  }

  // Barreira de tempo no servidor: depois do prazo nada mais é aceito, mesmo
  // que o cliente insista (aba congelada, relógio adulterado, requisição atrasada).
  // O banco reforça a mesma regra na política de RLS.
  const fim = new Date(tentativa.iniciado_em).getTime() + DURACAO_PROVA_SEGUNDOS * 1000
  if (Date.now() > fim) {
    return { ok: false as const, motivo: 'O tempo da prova acabou.' }
  }

  return { ok: true as const, supabase, tentativa }
}

/** Cria uma tentativa nova ou retoma a que estiver em andamento. */
export async function iniciarSimulado(simuladoNumero: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emAndamento } = await supabase
    .from('tentativas_simulado')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('simulado_numero', simuladoNumero)
    .eq('status', 'em_andamento')
    .maybeSingle()

  if (emAndamento) redirect(`/simulados/${simuladoNumero}/prova`)

  const { error } = await supabase.from('tentativas_simulado').insert({
    usuario_id: user.id,
    simulado_numero: simuladoNumero,
  })
  if (error) throw error

  redirect(`/simulados/${simuladoNumero}/prova`)
}

/** Grava (ou troca) a alternativa escolhida. Chamado a cada clique, não só no fim. */
export async function salvarResposta(
  tentativaId: string,
  questaoId: string,
  alternativa: Alternativa,
): Promise<Resultado> {
  const ctx = await tentativaEditavel(tentativaId)
  if (!ctx.ok) return ctx

  const { error } = await ctx.supabase.from('respostas_simulado').upsert(
    {
      tentativa_id: tentativaId,
      questao_id: questaoId,
      alternativa_escolhida: alternativa,
    },
    { onConflict: 'tentativa_id,questao_id' },
  )

  if (error) return { ok: false, motivo: 'Não foi possível salvar sua resposta.' }
  return { ok: true }
}

/** Marca/desmarca a questão para revisão. */
export async function alternarRevisao(
  tentativaId: string,
  questaoId: string,
  marcada: boolean,
): Promise<Resultado> {
  const ctx = await tentativaEditavel(tentativaId)
  if (!ctx.ok) return ctx

  const { error } = await ctx.supabase.from('respostas_simulado').upsert(
    {
      tentativa_id: tentativaId,
      questao_id: questaoId,
      marcada_para_revisao: marcada,
    },
    { onConflict: 'tentativa_id,questao_id' },
  )

  if (error) return { ok: false, motivo: 'Não foi possível marcar a questão.' }
  return { ok: true }
}

/**
 * Finaliza e corrige. A correção acontece inteiramente no Postgres
 * (função `finalizar_tentativa`), então o gabarito nunca trafega para o cliente.
 * É idempotente: o envio automático por tempo e o clique manual convergem.
 */
export async function finalizarSimulado(tentativaId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('finalizar_tentativa', {
    p_tentativa_id: tentativaId,
  })
  if (error) throw error

  revalidatePath('/simulados')
  revalidatePath('/dashboard')
  redirect(`/simulados/resultado/${tentativaId}`)
}
