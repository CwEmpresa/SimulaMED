/**
 * Cria (ou redefine) o usuário de desenvolvimento usado pelo login por senha
 * em /dev/login. Serve para verificação visual e testes das telas protegidas.
 *
 *   node --env-file=.env.local scripts/criar-usuario-dev.mjs
 *   node --env-file=.env.local scripts/criar-usuario-dev.mjs --limpar
 *
 * --limpar apaga tentativas e caderno de erros do usuário, deixando-o pronto
 * para começar um simulado do zero.
 *
 * Nunca rode isto apontando para o projeto de produção.
 */

import { createClient } from '@supabase/supabase-js'

const EMAIL = process.env.DEV_USER_EMAIL ?? 'dev@reta-final.local'
const SENHA = process.env.DEV_USER_SENHA ?? 'reta-final-dev'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 })
let usuario = lista.users.find((u) => u.email === EMAIL)

if (usuario) {
  await admin.auth.admin.updateUserById(usuario.id, { password: SENHA, email_confirm: true })
  console.log(`Usuário existente atualizado: ${EMAIL}`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: SENHA,
    email_confirm: true,
  })
  if (error) throw error
  usuario = data.user
  console.log(`Usuário criado: ${EMAIL}`)
}

// O middleware agora exige usuarios.acesso_liberado_em (só o webhook da
// Lowify marca isso em produção) — sem simular uma "compra aprovada" aqui, o
// próprio usuário de dev seria deslogado ao tentar entrar em qualquer tela.
await admin
  .from('usuarios')
  .update({ acesso_liberado_em: new Date().toISOString() })
  .eq('id', usuario.id)
  .is('acesso_liberado_em', null)

// Mesma lógica para primeiro_login_em: sem isso, os Simulados 2 e 3 (liberados
// 12h/24h após o primeiro login) ficariam bloqueados para sempre no ambiente
// de dev, já que /dev/login não passa por entrarComEmail (quem marca isso lá).
await admin
  .from('usuarios')
  .update({ primeiro_login_em: new Date().toISOString() })
  .eq('id', usuario.id)
  .is('primeiro_login_em', null)

if (process.argv.includes('--limpar')) {
  await admin.from('caderno_erros').delete().eq('usuario_id', usuario.id)
  await admin.from('respostas_banco').delete().eq('usuario_id', usuario.id)
  // respostas_simulado cai por cascata junto com as tentativas
  await admin.from('tentativas_simulado').delete().eq('usuario_id', usuario.id)
  // Volta ao estado de primeiro acesso, para o onboarding aparecer de novo.
  await admin
    .from('usuarios')
    .update({ onboarding_concluido_em: null })
    .eq('id', usuario.id)
  console.log('Tentativas, respostas, caderno de erros e onboarding resetados.')
}

console.log(`\nEntre em http://localhost:3000/dev/login`)
console.log(`  e-mail: ${EMAIL}`)
console.log(`  senha:  ${SENHA}`)
