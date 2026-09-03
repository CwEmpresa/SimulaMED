'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Marca o onboarding como visto e leva o aluno ao painel.
 *
 * A marca fica no banco (e não no navegador) para que a apresentação não
 * reapareça em outro aparelho nem some por limpeza de cache.
 */
export async function concluirOnboarding() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('usuarios')
    .update({ onboarding_concluido_em: new Date().toISOString() })
    .eq('id', user.id)

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
