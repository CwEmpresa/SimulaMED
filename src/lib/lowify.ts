import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Adaptador entre o payload bruto do webhook da Lowify e o formato que
 * `compras` espera.
 *
 * ATENÇÃO: não existe documentação pública da Lowify (busquei) nem um
 * payload de exemplo real neste projeto. Em vez de apostar num único
 * conjunto fixo de nomes de campo, este adaptador varre o payload inteiro
 * (chaves conhecidas de várias plataformas de checkout brasileiras -
 * Hotmart/Kiwify/Eduzz/Monetizze - e depois por palavra-chave/formato) e
 * pega o primeiro valor plausível para cada campo. Isso é deliberadamente
 * tolerante: o objetivo é não quebrar por causa de uma maiúscula ou um nome
 * de chave diferente do esperado, mesmo sem saber o formato real ainda.
 *
 * Quando o payload real existir, o mais provável é que isto já funcione
 * sem mudança nenhuma — mas se `interpretarEventoLowify` devolver `null`
 * para um payload de verdade, o handler loga o payload bruto inteiro
 * (ver route.ts), e é só ler esse log pra ver o que ajustar aqui.
 */
export type EventoLowify = {
  eventoId: string
  email: string
  produto: string | null
  status: 'pago' | 'reembolsado' | 'chargeback' | 'cancelado'
}

/** Palavras-chave por status, testadas contra qualquer string do payload
 * normalizada (minúscula, sem acento/pontuação) — cobre tanto chaves de
 * status explícitas ("event": "purchase_approved") quanto texto livre. */
const PALAVRAS_CHAVE_STATUS: Array<[RegExp, EventoLowify['status']]> = [
  [/chargeback|contestac/, 'chargeback'],
  [/reembols|refund/, 'reembolsado'],
  [/cancel/, 'cancelado'],
  [/aprov|approv|paid|pago|complet|confirm/, 'pago'],
]

const CHAVES_EMAIL = ['email', 'buyeremail', 'customeremail', 'compradoremail', 'e-mail']
const CHAVES_ID = [
  'id',
  'eventid',
  'event_id',
  'transactionid',
  'transaction_id',
  'orderid',
  'order_id',
  'purchaseid',
  'purchase_id',
  'saleid',
  'sale_id',
  'codigo',
  'codigotransacao',
]
const CHAVES_PRODUTO = ['product', 'produto', 'plan', 'plano', 'offer', 'oferta']
const CHAVES_STATUS = ['event', 'status', 'evento', 'eventtype', 'webhookeventtype', 'tipo']

function normalizarChave(chave: string): string {
  return chave.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Percorre o objeto inteiro (bounded) coletando `{ chaveNormalizada, valor }`
 * de todo par cujo valor seja string — é a base de todas as buscas abaixo. */
function coletarPares(
  valor: unknown,
  profundidade = 0,
  acumulado: Array<{ chave: string; valor: string }> = [],
): Array<{ chave: string; valor: string }> {
  if (profundidade > 4 || acumulado.length > 500) return acumulado
  if (typeof valor === 'string') return acumulado
  if (Array.isArray(valor)) {
    for (const item of valor) coletarPares(item, profundidade + 1, acumulado)
    return acumulado
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const [chave, v] of Object.entries(valor)) {
      if (typeof v === 'string') {
        acumulado.push({ chave: normalizarChave(chave), valor: v })
      } else {
        coletarPares(v, profundidade + 1, acumulado)
      }
    }
  }
  return acumulado
}

function buscarPorChaves(pares: Array<{ chave: string; valor: string }>, chaves: string[]): string | undefined {
  for (const alvo of chaves) {
    const achado = pares.find((p) => p.chave === alvo)
    if (achado && achado.valor.trim() !== '') return achado.valor
  }
  return undefined
}

function buscarEmailPorFormato(pares: Array<{ chave: string; valor: string }>): string | undefined {
  return pares.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.valor.trim()))?.valor
}

function buscarStatus(pares: Array<{ chave: string; valor: string }>): EventoLowify['status'] | undefined {
  // Primeiro só nas chaves que parecem "status de evento" — evita falso
  // positivo (ex.: nome do comprador contendo uma dessas palavras).
  const candidatosPrioritarios = pares.filter((p) => CHAVES_STATUS.includes(p.chave))
  for (const [padrao, status] of PALAVRAS_CHAVE_STATUS) {
    if (candidatosPrioritarios.some((p) => padrao.test(normalizarTexto(p.valor)))) return status
  }
  // Sem sorte: procura em qualquer string do payload.
  for (const [padrao, status] of PALAVRAS_CHAVE_STATUS) {
    if (pares.some((p) => padrao.test(normalizarTexto(p.valor)))) return status
  }
  return undefined
}

/** Devolve `null` quando o payload não tem e-mail nem status reconhecíveis —
 * o handler registra o payload bruto e recusa o evento em vez de adivinhar
 * o que fazer. `eventoId` sempre existe: cai para um hash do payload quando
 * nenhum campo parece um identificador, o que mantém a idempotência mesmo
 * sem saber o nome real do campo de id. */
export function interpretarEventoLowify(payload: unknown): EventoLowify | null {
  if (typeof payload !== 'object' || payload === null) return null

  const pares = coletarPares(payload)

  const email = buscarPorChaves(pares, CHAVES_EMAIL) ?? buscarEmailPorFormato(pares)
  const status = buscarStatus(pares)
  if (!email || !status) return null

  const eventoId =
    buscarPorChaves(pares, CHAVES_ID) ??
    createHash('sha256').update(JSON.stringify(payload)).digest('hex')

  return {
    eventoId,
    email: email.trim().toLowerCase(),
    produto: buscarPorChaves(pares, CHAVES_PRODUTO) ?? null,
    status,
  }
}

/** Mesmas chaves aceitas por `assinaturaValida` para o segredo no corpo —
 * únicas que precisam ser mascaradas antes de logar ou persistir o payload. */
const CHAVES_SECRETAS = new Set(['token', 'secret', 'webhooksecret'])

/**
 * Mascara qualquer campo do payload cuja chave (normalizada) seja uma das
 * usadas para autenticar o webhook pelo corpo. Sem isso, um payload
 * autenticado via `{ "token": "..." }` vazaria o próprio segredo compartilhado
 * no log de `payload_nao_reconhecido` e na coluna `compras.payload_bruto` —
 * ambos persistem o payload inteiro, e um segredo em texto puro num log ou
 * numa tabela é exatamente o tipo de exposição que a assinatura devia evitar.
 */
export function sanitizarPayload(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sanitizarPayload)
  if (typeof valor === 'object' && valor !== null) {
    const saida: Record<string, unknown> = {}
    for (const [chave, v] of Object.entries(valor)) {
      saida[chave] = CHAVES_SECRETAS.has(normalizarChave(chave)) ? '[redigido]' : sanitizarPayload(v)
    }
    return saida
  }
  return valor
}

/**
 * Mesma mascara para o caso raro de JSON.parse falhar: o corpo bruto não
 * parseado ainda pode conter `"token":"..."` ou `token=...` de propósito
 * (form-encoded), então o log do erro de parsing precisa da própria versão
 * em texto do mesmo cuidado acima.
 */
export function sanitizarTextoBruto(texto: string): string {
  return texto.replace(/(["']?(?:token|secret|webhook_?secret)["']?\s*[:=]\s*)["']?[^"',&\s}]*["']?/gi, '$1[redigido]')
}

/**
 * Confere o segredo compartilhado com a Lowify. Sem saber o esquema real,
 * aceita as três formas mais comuns entre plataformas de checkout
 * brasileiras — a primeira que bater já autentica:
 *   1. header configurável (padrão `x-lowify-token`, ajustável por
 *      LOWIFY_WEBHOOK_HEADER caso o nome real seja outro);
 *   2. query string `?token=` ou `?secret=` na própria URL do webhook
 *      (comum em plataformas que só permitem configurar a URL, sem headers
 *      customizados);
 *   3. campo `token`/`secret`/`webhook_secret` no corpo do próprio payload.
 * Sempre comparação de tempo constante.
 */
export function assinaturaValida(request: Request, payload: unknown, segredo: string): boolean {
  const esperado = Buffer.from(segredo)

  const candidatos: Array<string | null> = [
    request.headers.get(process.env.LOWIFY_WEBHOOK_HEADER ?? 'x-lowify-token'),
    new URL(request.url).searchParams.get('token'),
    new URL(request.url).searchParams.get('secret'),
  ]

  if (typeof payload === 'object' && payload !== null) {
    const pares = coletarPares(payload)
    candidatos.push(buscarPorChaves(pares, ['token', 'secret', 'webhooksecret']) ?? null)
  }

  return candidatos.some((candidato) => {
    if (!candidato) return false
    const recebido = Buffer.from(candidato)
    if (esperado.length !== recebido.length) return false
    return timingSafeEqual(esperado, recebido)
  })
}
