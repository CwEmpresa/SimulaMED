import { NextResponse } from 'next/server'

import { assinaturaValida, interpretarEventoLowify } from '@/lib/lowify'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_REVOGA_ACESSO = new Set(['reembolsado', 'chargeback', 'cancelado'])

/**
 * Webhook da Lowify: única fonte que libera (ou revoga) acesso ao SimulaMED.
 *
 * Não existe mais cadastro manual/convite nem magic link — o aluno só entra
 * digitando o e-mail em /login (ver src/app/actions/acesso.ts), que confere
 * `usuarios.acesso_liberado_em`. Essa marca só é escrita aqui:
 *
 * - `status === 'pago'`: acha a conta pelo e-mail ou CRIA (sem enviar
 *   e-mail nenhum: `admin.auth.admin.createUser` com `email_confirm: true`,
 *   o mesmo mecanismo já usado por scripts/criar-usuario-dev.mjs) e marca
 *   `acesso_liberado_em` se ainda não estava marcada.
 * - `status` em reembolsado/chargeback/cancelado: limpa `acesso_liberado_em`
 *   se a conta existir — a partir da próxima requisição o middleware
 *   (src/lib/supabase/middleware.ts) já desloga e barra o acesso.
 *
 * Idempotente por `evento_id`: reentrega do mesmo evento faz upsert, nunca
 * duplica nem processa duas vezes.
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
  const email = evento.email.toLowerCase()

  // eq (não ilike): o Supabase Auth já normaliza e-mail para minúsculas no
  // cadastro, e ilike trataria '%'/'_' no e-mail como curinga de LIKE.
  const { data: usuarioExistente } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', email)
    .maybeSingle()

  let usuarioId = usuarioExistente?.id ?? null

  // Só cria conta nova numa compra aprovada — é o webhook que decide quem
  // existe no sistema, nunca a tela de acesso.
  if (!usuarioId && evento.status === 'pago') {
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (erroCriar || !criado.user) {
      console.error('Falha ao criar conta para compra aprovada:', erroCriar?.message)
      return NextResponse.json({ erro: 'falha_ao_criar_conta' }, { status: 500 })
    }
    usuarioId = criado.user.id
  }

  const { error: erroCompra } = await admin.from('compras').upsert(
    {
      evento_id: evento.eventoId,
      email: evento.email,
      produto: evento.produto,
      status: evento.status,
      usuario_id: usuarioId,
      payload_bruto: payload,
    },
    { onConflict: 'evento_id' },
  )

  if (erroCompra) {
    console.error('Falha ao gravar compra da Lowify:', erroCompra.message)
    return NextResponse.json({ erro: 'falha_ao_gravar' }, { status: 500 })
  }

  if (usuarioId) {
    if (evento.status === 'pago') {
      await admin
        .from('usuarios')
        .update({ acesso_liberado_em: new Date().toISOString() })
        .eq('id', usuarioId)
        .is('acesso_liberado_em', null)
    } else if (STATUS_REVOGA_ACESSO.has(evento.status)) {
      await admin.from('usuarios').update({ acesso_liberado_em: null }).eq('id', usuarioId)
    }
  }

  return NextResponse.json({ ok: true })
}
