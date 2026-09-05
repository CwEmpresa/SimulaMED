/**
 * Testa o que o aluno pode e não pode gravar na própria linha de `usuarios`,
 * mais o ciclo do onboarding. Roda como aluno real (chave anon + RLS).
 *
 * O ponto sensível: `email` liga a conta à compra na Lowify e é a chave que o
 * aluno digita para entrar (ver src/app/actions/acesso.ts). O RLS garante "só
 * a própria linha", mas não "só estas colunas" — a restrição vem do grant de
 * coluna, e é isso que se verifica aqui.
 *
 *   node --env-file=.env.local scripts/testar-conta.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const falhas = []
function checar(condicao, descricao, detalhe = '') {
  if (condicao) console.log(`  ok    ${descricao}`)
  else {
    console.log(`  FALHA ${descricao} ${detalhe}`)
    falhas.push(descricao)
  }
}

let userId = null

try {
  const email = `conta-${Date.now()}@exemplo-reta-final.test`
  const senha = `Teste!${Math.random().toString(36).slice(2)}Aa1`
  const { data: criado, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw error
  userId = criado.user.id

  const aluno = createClient(URL, ANON, { auth: { persistSession: false } })
  await aluno.auth.signInWithPassword({ email, password: senha })
  console.log('\n1. Estado inicial')

  const { data: inicial } = await aluno
    .from('usuarios')
    .select('nome, email, onboarding_concluido_em')
    .eq('id', userId)
    .single()
  checar(inicial.email === email, 'e-mail espelhado do auth')
  checar(inicial.onboarding_concluido_em === null, 'onboarding começa não concluído')

  // ── o que PODE ser alterado ───────────────────────────────────────────────
  console.log('\n2. Colunas editáveis pelo aluno')
  const { error: erroNome } = await aluno
    .from('usuarios')
    .update({ nome: 'Nome de Teste' })
    .eq('id', userId)
  checar(!erroNome, 'aluno consegue alterar o próprio nome')

  const { error: erroOnb } = await aluno
    .from('usuarios')
    .update({ onboarding_concluido_em: new Date().toISOString() })
    .eq('id', userId)
  checar(!erroOnb, 'aluno consegue marcar o onboarding como concluído')

  const { data: depois } = await aluno
    .from('usuarios')
    .select('nome, onboarding_concluido_em')
    .eq('id', userId)
    .single()
  checar(depois.nome === 'Nome de Teste', 'nome persistido')
  checar(!!depois.onboarding_concluido_em, 'marca de onboarding persistida')

  // ── o que NÃO pode ────────────────────────────────────────────────────────
  console.log('\n3. Colunas protegidas')
  const { error: erroEmail } = await aluno
    .from('usuarios')
    .update({ email: 'invasor@exemplo.test' })
    .eq('id', userId)
  checar(!!erroEmail, 'aluno NÃO altera o próprio e-mail (chave da compra)',
    erroEmail ? '' : '(ALTERAÇÃO PERMITIDA!)')

  const { error: erroCriado } = await aluno
    .from('usuarios')
    .update({ criado_em: '2020-01-01T00:00:00Z' })
    .eq('id', userId)
  checar(!!erroCriado, 'aluno NÃO altera a data de início de acesso')

  const { data: intacto } = await aluno
    .from('usuarios')
    .select('email, criado_em')
    .eq('id', userId)
    .single()
  checar(intacto.email === email, 'e-mail seguiu intacto após as tentativas')

  // ── linha alheia ──────────────────────────────────────────────────────────
  console.log('\n4. Linha de outro aluno')
  const email2 = `conta-b-${Date.now()}@exemplo-reta-final.test`
  const { data: criado2 } = await admin.auth.admin.createUser({
    email: email2,
    password: senha,
    email_confirm: true,
  })

  const { error: erroAlheio, count } = await aluno
    .from('usuarios')
    .update({ nome: 'Invadido' }, { count: 'exact' })
    .eq('id', criado2.user.id)
  checar(!!erroAlheio || count === 0, 'aluno não altera o nome de outro aluno')

  const { data: outroIntacto } = await admin
    .from('usuarios')
    .select('nome')
    .eq('id', criado2.user.id)
    .single()
  checar(outroIntacto.nome === null, 'a linha do outro aluno seguiu intacta')

  await admin.auth.admin.deleteUser(criado2.user.id)
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('\nUsuários de teste removidos.')
}

console.log('')
if (falhas.length) {
  console.error(`FALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
console.log('Todas as verificações de conta e onboarding passaram.')
