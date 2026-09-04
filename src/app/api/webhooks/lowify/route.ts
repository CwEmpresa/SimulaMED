import { NextResponse } from 'next/server'

import { assinaturaValida, interpretarEventoLowify } from '@/lib/lowify'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook da Lowify: vincula uma compra à conta correspondente (por e-mail).
 *
 * Duas direções são possíveis:
 * - conta já existe (cadastro manual/convite anterior) → este handler acha o
 *   usuário pelo e-mail e marca `usuarios.acesso_liberado_em` na hora;
 * - conta ainda não existe (aluno comprou antes de se cadastrar) → a compra
 *   fica salva com `usuario_id` nulo, e o trigger `handle_new_user` (ver
 *   migração `12_vinculo_compra_lowify`) faz o vínculo quando a conta for
 *   criada pelo magic link.
 *
 * Idempotente por `evento_id`: reentrega do mesmo evento (comum em webhooks)
 * faz upsert, nunca duplica nem libera acesso duas vezes.
 *
 * NÃO ESTÁ PRONTO PARA PRODUÇÃO: `interpretarEventoLowify` (src/lib/lowify.ts)
 * assume nomes de campo prováveis, não confirmados contra a documentação real
 * da Lowify. Ver a checagem de assinatura abaixo — hoje é um token estático
 * em header, ajustar se a Lowify usar HMAC.
 */
export async function POST(request: Request) {
  const segredo = process.env.LOWIFY_WEBHOOK_SECRET
  if (!segredo) {
    console.error('LOWIFY_WEBHOOK_SECRET não configurado — webhook recusado.')
    return NextResponse.json({ erro: 'not_configured' }, { status: 500 })
  }

  const headerToken = request.headers.get('x-lowify-token')
  if (!assinaturaValida(headerToken, segredo)) {
    return NextResponse.json({ erro: 'assinatura_invalida' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const evento = payload ? interpretarEventoLowify(payload) : null
  if (!evento) {
    console.error('Payload da Lowify não reconhecido pelo adaptador:', JSON.stringify(payload))
    return NextResponse.json({ erro: 'payload_nao_reconhecido' }, { status: 422 })
  }

  const admin = createAdminClient()

  // eq (não ilike): o Supabase Auth já normaliza e-mail para minúsculas no
  // cadastro, e ilike trataria '%'/'_' no e-mail como curinga de LIKE.
  const { data: usuarioExistente } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', evento.email.toLowerCase())
    .maybeSingle()

  const { error: erroCompra } = await admin.from('compras').upsert(
    {
      evento_id: evento.eventoId,
      email: evento.email,
      produto: evento.produto,
      status: evento.status,
      usuario_id: usuarioExistente?.id ?? null,
      payload_bruto: payload,
    },
    { onConflict: 'evento_id' },
  )

  if (erroCompra) {
    console.error('Falha ao gravar compra da Lowify:', erroCompra.message)
    return NextResponse.json({ erro: 'falha_ao_gravar' }, { status: 500 })
  }

  if (usuarioExistente && evento.status === 'pago' && !usuarioExistente.acesso_liberado_em) {
    await admin
      .from('usuarios')
      .update({ acesso_liberado_em: new Date().toISOString() })
      .eq('id', usuarioExistente.id)
  }

  return NextResponse.json({ ok: true })
}
