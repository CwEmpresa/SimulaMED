/**
 * Libera acesso administrativo/manual a uma conta, sem passar pela compra
 * aprovada na Lowify — para o próprio Carlos ou qualquer outra conta que
 * precise de acesso fora do fluxo normal (parceiro, teste combinado, etc.).
 *
 * Usa exatamente o mesmo mecanismo que o webhook usa numa compra aprovada
 * (`admin.auth.admin.createUser` com `email_confirm: true`, que não dispara
 * e-mail nenhum, + `usuarios.acesso_liberado_em`), então a conta entra em
 * `/login` do jeito normal, digitando só o e-mail — não existe caminho
 * separado no frontend para isso.
 *
 * A diferença é `usuarios.acesso_manual_em`: marca que este acesso foi
 * concedido por aqui, não por uma compra. O webhook da Lowify
 * (src/app/api/webhooks/lowify/route.ts) confere essa marca antes de revogar
 * acesso num reembolso/chargeback/cancelamento — uma conta manual nunca é
 * derrubada por um evento desses, mesmo que o e-mail apareça num payload.
 *
 * Idempotente: se a conta já existe, só ajusta as marcas que estiverem
 * faltando (nunca cria duplicata, nunca sobrescreve uma data já gravada).
 *
 *   node --env-file=.env.local scripts/liberar-acesso-manual.mjs <email>
 *
 * Concede acesso permanente e à prova de reembolso — confirme o e-mail antes
 * de rodar, e nunca automatize esta chamada a partir de entrada não confiável.
 */

import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Uso: node --env-file=.env.local scripts/liberar-acesso-manual.mjs <email>')
  process.exit(1)
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: lista, error: erroListar } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (erroListar) throw erroListar
let usuario = lista.users.find((u) => u.email?.toLowerCase() === email)

if (usuario) {
  console.log(`Conta já existia: ${email} (${usuario.id})`)
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  usuario = data.user
  console.log(`Conta criada: ${email} (${usuario.id})`)
}

const agora = new Date().toISOString()

await admin
  .from('usuarios')
  .update({ acesso_liberado_em: agora })
  .eq('id', usuario.id)
  .is('acesso_liberado_em', null)

await admin
  .from('usuarios')
  .update({ acesso_manual_em: agora })
  .eq('id', usuario.id)
  .is('acesso_manual_em', null)

const { data: linha, error: erroLinha } = await admin
  .from('usuarios')
  .select('email, acesso_liberado_em, acesso_manual_em')
  .eq('id', usuario.id)
  .single()
if (erroLinha) throw erroLinha

console.log('\nAcesso liberado:')
console.log(`  e-mail:            ${linha.email}`)
console.log(`  acesso_liberado_em: ${linha.acesso_liberado_em}`)
console.log(`  acesso_manual_em:   ${linha.acesso_manual_em}`)
console.log('\nEsta conta entra em /login digitando só o e-mail acima, e não é revogada por reembolso/chargeback/cancelamento.')
