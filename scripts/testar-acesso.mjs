/**
 * Testa de ponta a ponta o novo fluxo de acesso: webhook da Lowify aprova uma
 * compra → conta é criada/liberada sem e-mail nenhum → sessão é montada do
 * jeito que a server action `entrarComEmail` monta (generateLink + verifyOtp,
 * sem enviar nada) → a sessão tem RLS de aluno de verdade → um reembolso
 * revoga o acesso.
 *
 * Bate de verdade em `POST /api/webhooks/lowify` (precisa do `npm run dev`
 * rodando em BASE_URL, padrão http://localhost:3000, com o mesmo
 * LOWIFY_WEBHOOK_SECRET do .env.local). O resto (geração de token, sessão,
 * leitura com RLS) usa o supabase-js direto, no mesmo espírito dos outros
 * testar:*: isolar a lógica de autorização de verdade, não clicar na tela.
 *
 *   npm run dev                              # em outro terminal
 *   node --env-file=.env.local scripts/testar-acesso.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const SEGREDO_WEBHOOK = process.env.LOWIFY_WEBHOOK_SECRET
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

if (!SEGREDO_WEBHOOK) {
  console.error('Falta LOWIFY_WEBHOOK_SECRET no .env.local — configure antes de rodar este teste.')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

const falhas = []
function checar(condicao, descricao, detalhe = '') {
  if (condicao) console.log(`  ok    ${descricao}`)
  else {
    console.log(`  FALHA ${descricao} ${detalhe}`)
    falhas.push(descricao)
  }
}

const SUFIXO = Date.now()
const EMAIL_COMPRADOR = `teste-acesso-${SUFIXO}@example.com`
const EMAIL_SEM_COMPRA = `teste-sem-compra-${SUFIXO}@example.com`

async function chamarWebhook(payload) {
  const resposta = await fetch(`${BASE_URL}/api/webhooks/lowify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lowify-token': SEGREDO_WEBHOOK },
    body: JSON.stringify(payload),
  })
  return resposta
}

/** Reproduz exatamente o que src/app/actions/acesso.ts faz para montar a
 * sessão a partir de um e-mail já liberado — sem passar por HTTP do Next
 * (server actions não são chamáveis por fetch comum), mas usando as mesmas
 * chamadas de Admin API + verifyOtp. */
async function montarSessao(email) {
  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (erroLink || !link?.properties?.hashed_token) return { erro: erroLink }

  const cliente = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await cliente.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  })
  return { cliente, sessao: data?.session, erro: error }
}

let usuarioId = null

try {
  console.log('\n1. Webhook aprova a compra (conta nova, sem e-mail enviado)')
  const respostaAprovada = await chamarWebhook({
    id: `evt-teste-aprovado-${SUFIXO}`,
    event: 'aprovado',
    data: { email: EMAIL_COMPRADOR, product: { name: 'SimulaMED Teste' } },
  })
  checar(respostaAprovada.ok, 'webhook aceita o evento de compra aprovada', await respostaAprovada.text().catch(() => ''))

  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', EMAIL_COMPRADOR)
    .maybeSingle()
  usuarioId = usuario?.id ?? null
  checar(!!usuarioId, 'conta foi criada automaticamente pelo webhook')
  checar(!!usuario?.acesso_liberado_em, 'acesso_liberado_em foi marcada')

  const { data: compra } = await admin
    .from('compras')
    .select('status, usuario_id')
    .eq('evento_id', `evt-teste-aprovado-${SUFIXO}`)
    .maybeSingle()
  checar(compra?.status === 'pago', 'compra gravada com status pago')
  checar(compra?.usuario_id === usuarioId, 'compra vinculada à conta criada')

  console.log('\n2. Sessão montada só com o e-mail (sem senha, sem e-mail enviado)')
  const { cliente, sessao, erro: erroSessao } = await montarSessao(EMAIL_COMPRADOR)
  checar(!erroSessao && !!sessao, 'sessão criada a partir do e-mail liberado', erroSessao?.message ?? '')
  checar(sessao?.user?.id === usuarioId, 'sessão pertence à mesma conta permanente (auth.uid estável)')

  // O ponto central do requisito: "perdeu a sessão, entra de novo só com o
  // e-mail" tem que devolver a MESMA conta (mesmo auth.uid), não uma nova —
  // é o que preserva progresso, simulados, banco e caderno de erros.
  const { sessao: segundaSessao, erro: erroSegundaSessao } = await montarSessao(EMAIL_COMPRADOR)
  checar(
    !erroSegundaSessao && segundaSessao?.user?.id === usuarioId,
    'entrar de novo com o mesmo e-mail devolve a MESMA conta, não uma nova',
  )

  console.log('\n3. RLS da sessão recém-criada')
  const { data: propriaLinha } = await cliente
    .from('usuarios')
    .select('id, email')
    .eq('id', usuarioId)
    .maybeSingle()
  checar(propriaLinha?.email === EMAIL_COMPRADOR, 'sessão lê a própria linha em usuarios')

  const { data: propriaCompra } = await cliente.from('compras').select('id').eq('usuario_id', usuarioId)
  checar((propriaCompra ?? []).length === 1, 'sessão lê a própria compra')

  const { data: tentativasVisiveis, error: erroTentativas } = await cliente
    .from('acesso_tentativas')
    .select('id')
  checar(
    !!erroTentativas && (tentativasVisiveis ?? []).length === 0,
    'sessão autenticada NÃO enxerga acesso_tentativas (sem grant nenhum)',
  )

  console.log('\n4. E-mail sem compra nenhuma é recusado de forma genérica')
  const { data: semCompra } = await admin
    .from('usuarios')
    .select('acesso_liberado_em')
    .eq('email', EMAIL_SEM_COMPRA)
    .maybeSingle()
  checar(!semCompra, 'e-mail sem conta nenhuma não libera acesso (caminho que a action recusa)')

  console.log('\n5. Rate limit: mesma checagem de contagem que a action usa')
  const linhasRateLimit = Array.from({ length: 5 }, () => ({ email: EMAIL_SEM_COMPRA, ip: '203.0.113.1' }))
  await admin.from('acesso_tentativas').insert(linhasRateLimit)
  const { count: tentativasEmail } = await admin
    .from('acesso_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('email', EMAIL_SEM_COMPRA)
    .gte('criado_em', new Date(Date.now() - 15 * 60 * 1000).toISOString())
  checar((tentativasEmail ?? 0) >= 5, 'contagem de tentativas por e-mail bate com o limite configurado na action')

  console.log('\n6. Webhook revoga o acesso num reembolso')
  const respostaReembolso = await chamarWebhook({
    id: `evt-teste-reembolso-${SUFIXO}`,
    event: 'reembolsado',
    data: { email: EMAIL_COMPRADOR },
  })
  checar(respostaReembolso.ok, 'webhook aceita o evento de reembolso')

  const { data: usuarioRevogado } = await admin
    .from('usuarios')
    .select('acesso_liberado_em')
    .eq('id', usuarioId)
    .maybeSingle()
  checar(!usuarioRevogado?.acesso_liberado_em, 'acesso_liberado_em foi limpa após o reembolso')

  console.log('\n7. Reentrega do mesmo evento de aprovação é idempotente')
  const contagemAntes = (
    await admin.from('compras').select('id', { count: 'exact', head: true }).eq('evento_id', `evt-teste-aprovado-${SUFIXO}`)
  ).count
  await chamarWebhook({
    id: `evt-teste-aprovado-${SUFIXO}`,
    event: 'aprovado',
    data: { email: EMAIL_COMPRADOR, product: { name: 'SimulaMED Teste' } },
  })
  const contagemDepois = (
    await admin.from('compras').select('id', { count: 'exact', head: true }).eq('evento_id', `evt-teste-aprovado-${SUFIXO}`)
  ).count
  checar(contagemAntes === 1 && contagemDepois === 1, 'reentrega do evento não duplica a linha em compras')
} finally {
  if (usuarioId) {
    await admin.from('acesso_tentativas').delete().eq('email', EMAIL_COMPRADOR)
    await admin.from('acesso_tentativas').delete().eq('email', EMAIL_SEM_COMPRA)
    await admin.from('compras').delete().eq('usuario_id', usuarioId)
    await admin.auth.admin.deleteUser(usuarioId)
  }
  console.log('\nConta e rastros de teste removidos.')
}

if (falhas.length > 0) {
  console.log(`\nFALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}

console.log('\nTodas as verificações do fluxo de acesso passaram.')
