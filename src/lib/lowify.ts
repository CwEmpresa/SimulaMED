import { timingSafeEqual } from 'node:crypto'

/**
 * Adaptador entre o payload bruto do webhook da Lowify e o formato que
 * `compras` espera.
 *
 * ATENÇÃO: a Lowify ainda não tem, neste projeto, um contrato de payload
 * documentado nem um payload de exemplo real. Os nomes de campo abaixo
 * (`email`/`buyer.email`, `event`/`status`, `id`/`transaction_id`...) são um
 * palpite a partir de formatos comuns de checkout — PRECISAM ser conferidos
 * contra a documentação real da Lowify (ou um payload de exemplo capturado
 * em produção) antes desta integração ir ao ar. Até lá, `interpretarEventoLowify`
 * é o único lugar que precisa mudar: se o payload real usar outros nomes de
 * campo, ajuste só as listas de candidatos abaixo.
 */
export type EventoLowify = {
  eventoId: string
  email: string
  produto: string | null
  status: 'pago' | 'reembolsado' | 'chargeback' | 'cancelado'
}

const MAPA_STATUS: Record<string, EventoLowify['status']> = {
  aprovado: 'pago',
  pago: 'pago',
  paid: 'pago',
  compra_aprovada: 'pago',
  approved: 'pago',
  reembolsado: 'reembolsado',
  refunded: 'reembolsado',
  chargeback: 'chargeback',
  cancelado: 'cancelado',
  cancelled: 'cancelado',
  canceled: 'cancelado',
}

function primeiraString(...valores: unknown[]): string | undefined {
  for (const valor of valores) {
    if (typeof valor === 'string' && valor.trim() !== '') return valor
  }
  return undefined
}

/** Devolve `null` quando o payload não tem os campos mínimos — o handler
 * registra o payload bruto e recusa o evento em vez de adivinhar. */
export function interpretarEventoLowify(payload: unknown): EventoLowify | null {
  if (typeof payload !== 'object' || payload === null) return null
  const raiz = payload as Record<string, unknown>
  const dados = (raiz.data ?? raiz) as Record<string, unknown>
  const comprador = (dados.buyer ?? dados.comprador ?? dados.customer ?? {}) as Record<
    string,
    unknown
  >
  const produtoObjeto = (dados.product ?? dados.plan ?? {}) as Record<string, unknown>

  const email = primeiraString(dados.email, comprador.email)
  const statusBruto = primeiraString(raiz.event, dados.status, dados.evento)?.toLowerCase()
  const eventoId = primeiraString(raiz.id, raiz.event_id, dados.id, dados.transaction_id)

  if (!email || !statusBruto || !eventoId) return null

  const status = MAPA_STATUS[statusBruto]
  if (!status) return null

  return {
    eventoId,
    email,
    produto: primeiraString(produtoObjeto.name, dados.produto) ?? null,
    status,
  }
}

/**
 * Confere um segredo compartilhado enviado num header simples. Ajustar o
 * nome do header e o esquema (token estático vs. HMAC assinado) contra a
 * documentação real da Lowify — este é o esquema mínimo (token estático)
 * até isso ser confirmado.
 */
export function assinaturaValida(headerRecebido: string | null, segredo: string): boolean {
  if (!headerRecebido) return false
  const esperado = Buffer.from(segredo)
  const recebido = Buffer.from(headerRecebido)
  if (esperado.length !== recebido.length) return false
  return timingSafeEqual(esperado, recebido)
}
