'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Login por e-mail, sem senha, sem magic link e sem SMTP.
 *
 * O webhook da Lowify (src/app/api/webhooks/lowify/route.ts) é a ÚNICA fonte
 * que marca `usuarios.acesso_liberado_em` — esta action só lê essa marca e,
 * se estiver presente, cria uma sessão de verdade para o mesmo usuário
 * permanente de sempre (mesmo `auth.uid()`, mesmo progresso). Ela nunca cria
 * conta: quem faz isso é o webhook.
 *
 * Como a sessão é criada sem o aluno nunca receber e-mail nenhum:
 * `admin.auth.admin.generateLink` gera o token de um magic link SEM enviar
 * e-mail (é só um par de propriedades devolvido pela Admin API) e
 * `verifyOtp` troca esse token por uma sessão real na mesma requisição,
 * inteiramente no servidor. O aluno nunca vê o token nem o link.
 *
 * `service_role` (via createAdminClient) só é usado aqui dentro de uma server
 * action — código que roda exclusivamente no servidor Next.js, nunca enviado
 * ao browser.
 */

const JANELA_RATE_LIMIT_MS = 15 * 60 * 1000
const LIMITE_TENTATIVAS_POR_EMAIL = 5
const LIMITE_TENTATIVAS_POR_IP = 20

function normalizarEmail(valor: FormDataEntryValue | null): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
}

async function obterIp(): Promise<string> {
  const cabecalhos = await headers()
  const encaminhado = cabecalhos.get('x-forwarded-for')
  if (encaminhado) return encaminhado.split(',')[0]!.trim()
  return cabecalhos.get('x-real-ip') ?? 'desconhecido'
}

function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = String(valor ?? '')
  // Só caminho relativo dentro do próprio app — nunca redirecionar pra fora.
  return destino.startsWith('/') && !destino.startsWith('//') ? destino : '/dashboard'
}

function redirecionarComErro(erro: string, destino: string): never {
  const params = new URLSearchParams({ erro })
  if (destino !== '/dashboard') params.set('redirect', destino)
  redirect(`/login?${params.toString()}`)
}

export async function entrarComEmail(formData: FormData) {
  const email = normalizarEmail(formData.get('email'))
  const destino = destinoSeguro(formData.get('redirect'))

  if (!email || !email.includes('@')) {
    redirecionarComErro('email_invalido', destino)
  }

  const admin = createAdminClient()
  const ip = await obterIp()
  const desde = new Date(Date.now() - JANELA_RATE_LIMIT_MS).toISOString()

  // Conta tentativas ANTES de registrar a atual, e só então insere — a
  // tentativa de agora nunca conta contra o próprio limite, só contra o das
  // próximas. Resposta de "muitas tentativas" não distingue se o e-mail tem
  // compra aprovada ou não: só fala da frequência.
  const [{ count: tentativasEmail }, { count: tentativasIp }] = await Promise.all([
    admin
      .from('acesso_tentativas')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('criado_em', desde),
    admin
      .from('acesso_tentativas')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('criado_em', desde),
  ])

  await admin.from('acesso_tentativas').insert({ email, ip })

  if (
    (tentativasEmail ?? 0) >= LIMITE_TENTATIVAS_POR_EMAIL ||
    (tentativasIp ?? 0) >= LIMITE_TENTATIVAS_POR_IP
  ) {
    redirecionarComErro('muitas_tentativas', destino)
  }

  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, email, acesso_liberado_em')
    .eq('email', email)
    .maybeSingle()

  // Resposta idêntica para "e-mail não existe", "existe mas sem compra
  // aprovada" e "compra reembolsada/cancelada depois" — de propósito, para
  // não dar pistas de quais e-mails têm compra.
  if (!usuario?.acesso_liberado_em) {
    redirecionarComErro('sem_acesso', destino)
  }

  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: usuario.email,
  })

  const hashedToken = link?.properties?.hashed_token
  if (erroLink || !hashedToken) {
    console.error('Falha ao gerar token de acesso:', erroLink?.message)
    redirecionarComErro('sem_acesso', destino)
  }

  const supabase = await createClient()
  const { error: erroSessao } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashedToken,
  })

  if (erroSessao) {
    console.error('Falha ao criar sessão a partir do token:', erroSessao.message)
    redirecionarComErro('sem_acesso', destino)
  }

  redirect(destino)
}
