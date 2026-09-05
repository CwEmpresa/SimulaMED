'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Atualiza o nome do usuário.
 *
 * O e-mail não é editável: ele é a chave que liga a conta à compra na Lowify
 * e ao próprio login (o aluno entra digitando esse e-mail). Trocá-lo aqui
 * romperia os dois — qualquer mudança de e-mail tem que passar pelo webhook.
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
