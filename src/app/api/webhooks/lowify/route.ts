import { NextResponse } from 'next/server'

import { assinaturaValida, interpretarEventoLowify } from '@/lib/lowify'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'

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
 * duplica nem processa duas vezes — e `interpretarEventoLowify` (ver
 * src/lib/lowify.ts) cai para um hash do corpo quando não acha um campo de
 * id, então a idempotência não depende de adivinhar o nome certo do campo.
 *
 * NÃO EXISTE DOCUMENTAÇÃO PÚBLICA DA LOWIFY (já busquei) nem payload de
 * exemplo real. `interpretarEventoLowify` varre o payload por palavra-chave
 * em vez de nomes de campo fixos — bem mais tolerante a formato desconhecido
 * — mas se um payload real cair aqui e vier `payload_nao_reconhecido`, o log
 * abaixo mostra o corpo bruto inteiro, e é só ajustar as listas de chaves em
 * src/lib/lowify.ts.
 */
export async function POST(request: Request) {
  const segredo = process.env.LOWIFY_WEBHOOK_SECRET
  if (!segredo) {
    console.error('LOWIFY_WEBHOOK_SECRET não configurado — webhook recusado.')
    return NextResponse.json({ erro: 'not_configured' }, { status: 500 })
  }

  const textoBruto = await request.text()
  let payload: Json = null
  try {
    payload = textoBruto ? JSON.parse(textoBruto) : null
  } catch {
    console.error('Payload da Lowify não é JSON válido:', textoBruto.slice(0, 2000))
    return NextResponse.json({ erro: 'payload_invalido' }, { status: 400 })
  }

  if (!assinaturaValida(request, payload, segredo)) {
    return NextResponse.json({ erro: 'assinatura_invalida' }, { status: 401 })
  }

  const evento = interpretarEventoLowify(payload)
  if (!evento) {
    console.error('Payload da Lowify não reconhecido pelo adaptador:', JSON.stringify(payload))
    return NextResponse.json({ erro: 'payload_nao_reconhecido' }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data: usuarioExistente } = await admin
    .from('usuarios')
    .select('id, acesso_liberado_em')
    .eq('email', evento.email)
    .maybeSingle()

  let usuarioId = usuarioExistente?.id ?? null

  // Só cria conta nova numa compra aprovada — é o webhook que decide quem
  // existe no sistema, nunca a tela de acesso.
  if (!usuarioId && evento.status === 'pago') {
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email: evento.email,
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
