'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Atualiza o nome do usuário.
 *
 * O e-mail não é editável: ele é a chave que liga a conta à compra na Lowify.
 * Trocá-lo aqui romperia esse vínculo — quando o webhook da fase 2 existir,
 * qualquer mudança de e-mail terá de passar por ele.
 */
export async function salvarNome(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim().slice(0, 120)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('usuarios')
    .update({ nome: nome === '' ? null : nome })
    .eq('id', user.id)

  revalidatePath('/perfil')
  revalidatePath('/dashboard')
}
