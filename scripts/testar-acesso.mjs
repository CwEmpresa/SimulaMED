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
const EMAIL_COMPRADOR_2 = `teste-acesso-formato-alt-${SUFIXO}@example.com`
const EMAIL_COMPRADOR_3 = `teste-acesso-query-${SUFIXO}@example.com`
const EMAIL_ACESSO_MANUAL = `teste-acesso-manual-${SUFIXO}@example.com`
const EMAIL_SEGREDO_NO_CORPO = `teste-acesso-corpo-${SUFIXO}@example.com`
const EMAIL_FORMATO_REAL = `teste-formato-real-${SUFIXO}@example.com`
const EMAIL_ORDER_ID = `teste-order-id-${SUFIXO}@example.com`

async function chamarWebhook(payload, { querystring } = {}) {
  const url = querystring
    ? `${BASE_URL}/api/webhooks/lowify?${querystring}=${SEGREDO_WEBHOOK}`
    : `${BASE_URL}/api/webhooks/lowify`
  const headers = { 'Content-Type': 'application/json' }
  if (!querystring) headers['x-lowify-token'] = SEGREDO_WEBHOOK
  const resposta = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
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

  console.log('\n8. Formato de payload totalmente diferente (estilo Hotmart) também é reconhecido')
  const respostaFormatoAlt = await chamarWebhook({
    event: 'PURCHASE_APPROVED',
    data: {
      buyer: { email: EMAIL_COMPRADOR_2 },
      purchase: { transaction: `HP-${SUFIXO}` },
    },
  })
  checar(respostaFormatoAlt.ok, 'webhook reconhece payload em formato diferente (chaves/nesting distintos)')
  const { data: usuario2 } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', EMAIL_COMPRADOR_2)
    .maybeSingle()
  const usuarioId2 = usuario2?.id ?? null
  checar(!!usuarioId2 && !!usuario2?.acesso_liberado_em, 'conta liberada mesmo com nomes de campo diferentes do teste 1')

  console.log('\n9. Cancelamento revoga (palavra-chave em inglês, maiúscula)')
  await chamarWebhook({
    event: 'ORDER_CANCELLED',
    data: { buyer: { email: EMAIL_COMPRADOR_2 }, purchase: { transaction: `HP-CANCEL-${SUFIXO}` } },
  })
  const { data: usuario2Cancelado } = await admin
    .from('usuarios')
    .select('acesso_liberado_em')
    .eq('id', usuarioId2)
    .maybeSingle()
  checar(!usuario2Cancelado?.acesso_liberado_em, 'cancelamento também revoga acesso_liberado_em')

  console.log('\n10. Chargeback revoga (reaprova antes, pra provar que o chargeback é quem derruba)')
  await chamarWebhook({
    event: 'PURCHASE_APPROVED',
    data: { buyer: { email: EMAIL_COMPRADOR_2 }, purchase: { transaction: `HP-REAPROVA-${SUFIXO}` } },
  })
  await chamarWebhook({
    event: 'chargeback_created',
    data: { buyer: { email: EMAIL_COMPRADOR_2 }, purchase: { transaction: `HP-CHB-${SUFIXO}` } },
  })
  const { data: usuario2Chargeback } = await admin
    .from('usuarios')
    .select('acesso_liberado_em')
    .eq('id', usuarioId2)
    .maybeSingle()
  checar(!usuario2Chargeback?.acesso_liberado_em, 'chargeback revoga acesso_liberado_em')

  console.log('\n11. Autenticação por query string (?token=), sem header nenhum')
  const respostaQuery = await chamarWebhook(
    { event: 'aprovado', data: { email: EMAIL_COMPRADOR_3 } },
    { querystring: 'token' },
  )
  checar(respostaQuery.ok, 'webhook aceita o segredo via query string quando não há header')
  const { data: usuario3 } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', EMAIL_COMPRADOR_3)
    .maybeSingle()
  const usuarioId3 = usuario3?.id ?? null
  checar(!!usuarioId3 && !!usuario3?.acesso_liberado_em, 'conta liberada autenticando só por query string')

  console.log('\n12. Idempotência por hash quando o payload não tem nenhum campo de id')
  const payloadSemId = { event: 'aprovado', data: { email: EMAIL_COMPRADOR_3, nota: 'sem id nenhum' } }
  await chamarWebhook(payloadSemId)
  await chamarWebhook(payloadSemId)
  const { data: comprasSemId } = await admin
    .from('compras')
    .select('id')
    .eq('email', EMAIL_COMPRADOR_3)
  checar(
    (comprasSemId ?? []).length === 2, // a do passo 11 (com evento_id "real") + uma via hash do passo 12
    'payload sem campo de id reconhecível ainda assim é idempotente (hash do corpo)',
    `(vieram ${(comprasSemId ?? []).length})`,
  )
  console.log('\n13. Conta com acesso manual sobrevive a reembolso/chargeback/cancelamento')
  await chamarWebhook({
    id: `evt-teste-manual-aprovado-${SUFIXO}`,
    event: 'aprovado',
    data: { email: EMAIL_ACESSO_MANUAL },
  })
  const { data: usuarioManualAntes } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', EMAIL_ACESSO_MANUAL)
    .maybeSingle()
  const usuarioIdManual = usuarioManualAntes?.id ?? null
  checar(!!usuarioIdManual && !!usuarioManualAntes?.acesso_liberado_em, 'conta de teste criada e liberada normalmente')

  // Marca a mesma coluna que scripts/liberar-acesso-manual.mjs marcaria —
  // é essa marca, e não o script em si, que o webhook confere.
  await admin
    .from('usuarios')
    .update({ acesso_manual_em: new Date().toISOString() })
    .eq('id', usuarioIdManual)

  await chamarWebhook({
    id: `evt-teste-manual-reembolso-${SUFIXO}`,
    event: 'reembolsado',
    data: { email: EMAIL_ACESSO_MANUAL },
  })
  const { data: usuarioManualDepois } = await admin
    .from('usuarios')
    .select('acesso_liberado_em, acesso_manual_em')
    .eq('id', usuarioIdManual)
    .maybeSingle()
  checar(
    !!usuarioManualDepois?.acesso_liberado_em,
    'acesso_liberado_em NÃO foi limpa: conta com acesso_manual_em ignora o reembolso',
    `(veio ${usuarioManualDepois?.acesso_liberado_em})`,
  )
  checar(!!usuarioManualDepois?.acesso_manual_em, 'acesso_manual_em continua marcada depois do evento')

  console.log('\n14. Segredo enviado dentro do corpo é aceito, mas nunca fica gravado em texto puro')
  const respostaSegredoNoCorpo = await fetch(`${BASE_URL}/api/webhooks/lowify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `evt-teste-corpo-${SUFIXO}`,
      event: 'aprovado',
      token: SEGREDO_WEBHOOK,
      data: { email: EMAIL_SEGREDO_NO_CORPO },
    }),
  })
  checar(respostaSegredoNoCorpo.ok, 'webhook aceita o segredo enviado dentro do corpo')

  const { data: compraComSegredoNoCorpo } = await admin
    .from('compras')
    .select('payload_bruto')
    .eq('evento_id', `evt-teste-corpo-${SUFIXO}`)
    .maybeSingle()
  const brutoGravado = JSON.stringify(compraComSegredoNoCorpo?.payload_bruto ?? {})
  checar(
    !brutoGravado.includes(SEGREDO_WEBHOOK),
    'compras.payload_bruto NÃO contém o segredo em texto puro',
  )
  checar(brutoGravado.includes('[redigido]'), 'o campo do segredo foi mascarado, não removido silenciosamente')

  console.log('\n15. Formato real confirmado da Lowify (sale_id / customer.email / product.name)')
  const saleIdReal = `ord_teste_formato_real_${SUFIXO}`
  const respostaFormatoReal = await chamarWebhook({
    event: 'sale.paid',
    is_test: true,
    product: { id: 0, name: 'Produto de Teste' },
    sale_id: saleIdReal,
    customer: { name: 'Cliente Teste', email: EMAIL_FORMATO_REAL, phone: '11999999999' },
    tracking: { click_id: 'click_test', utm_source: 'test', campaign_id: 'campaign_test' },
    timestamp: '2026-09-06 03:03:47',
  })
  checar(respostaFormatoReal.ok, 'webhook aceita o formato real confirmado em produção')

  const { data: compraFormatoReal } = await admin
    .from('compras')
    .select('evento_id, produto, status, usuario_id')
    .eq('evento_id', saleIdReal)
    .maybeSingle()
  checar(compraFormatoReal?.evento_id === saleIdReal, 'sale_id vira evento_id (não cai no fallback de hash)')
  checar(compraFormatoReal?.produto === 'Produto de Teste', 'product.name é extraído explicitamente')
  checar(compraFormatoReal?.status === 'pago', '"sale.paid" é interpretado como pago')

  const { data: usuarioFormatoReal } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', EMAIL_FORMATO_REAL)
    .maybeSingle()
  checar(
    !!usuarioFormatoReal?.id && usuarioFormatoReal.id === compraFormatoReal?.usuario_id,
    'customer.email cria a conta e vincula à compra',
  )
  checar(!!usuarioFormatoReal?.acesso_liberado_em, 'acesso_liberado_em foi marcada')

  const respostaFormatoRealReembolso = await chamarWebhook({
    event: 'sale.refunded',
    sale_id: `${saleIdReal}-reembolso`,
    customer: { email: EMAIL_FORMATO_REAL },
  })
  checar(respostaFormatoRealReembolso.ok, 'webhook aceita "sale.refunded" no mesmo formato')
  const { data: usuarioFormatoRealDepois } = await admin
    .from('usuarios')
    .select('acesso_liberado_em')
    .eq('email', EMAIL_FORMATO_REAL)
    .maybeSingle()
  checar(
    !usuarioFormatoRealDepois?.acesso_liberado_em,
    '"sale.refunded" revoga acesso_liberado_em (via casamento de palavra-chave, "refunded" ainda não confirmado)',
  )

  console.log('\n16. Variação real com order_id (compra de verdade), não sale_id (teste do painel)')
  const orderIdReal = `ord_teste_order_id_${SUFIXO}`
  const respostaOrderId = await chamarWebhook({
    event: 'sale.paid',
    status: 'paid',
    product: { id: 58165, name: 'SimulaMED', type: 'principal', price: 1 },
    customer: { name: 'Cliente Teste', email: EMAIL_ORDER_ID, phone: '11999999999' },
    order_id: orderIdReal,
    timestamp: '2026-09-06 03:31:12',
    sale_amount: 1,
  })
  checar(respostaOrderId.ok, 'webhook aceita a variação com order_id')
  const { data: compraOrderId } = await admin
    .from('compras')
    .select('evento_id, produto, status')
    .eq('evento_id', orderIdReal)
    .maybeSingle()
  checar(compraOrderId?.evento_id === orderIdReal, 'order_id vira evento_id quando sale_id não existe')
  checar(compraOrderId?.produto === 'SimulaMED', 'product.name é extraído mesmo sem sale_id')
  checar(compraOrderId?.status === 'pago', 'status "paid" é interpretado como pago')
} finally {
  const emails = [
    EMAIL_COMPRADOR,
    EMAIL_SEM_COMPRA,
    EMAIL_COMPRADOR_2,
    EMAIL_COMPRADOR_3,
    EMAIL_ACESSO_MANUAL,
    EMAIL_SEGREDO_NO_CORPO,
    EMAIL_FORMATO_REAL,
    EMAIL_ORDER_ID,
  ]
  for (const email of emails) {
    await admin.from('acesso_tentativas').delete().eq('email', email)
    const { data: usuario } = await admin.from('usuarios').select('id').eq('email', email).maybeSingle()
    if (usuario?.id) {
      await admin.from('compras').delete().eq('usuario_id', usuario.id)
      await admin.auth.admin.deleteUser(usuario.id)
    }
  }
  console.log('\nContas e rastros de teste removidos.')
}

if (falhas.length > 0) {
  console.log(`\nFALHAS (${falhas.length}):`)
  falhas.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}

console.log('\nTodas as verificações do fluxo de acesso passaram.')
