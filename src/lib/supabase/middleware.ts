import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from './types'

/**
 * Rotas que não exigem sessão.
 *
 * `/dev` só entra na lista fora de produção — é a terceira guarda do login por
 * senha, junto com a da página e a da server action.
 */
const ROTAS_PUBLICAS = [
  '/login',
  '/auth',
  '/termos',
  '/privacidade',
  // A Lowify chama isto sem sessão nenhuma — não é rota de aluno.
  '/api/webhooks',
  ...(process.env.NODE_ENV !== 'production' ? ['/dev'] : []),
]

/**
 * Renova o cookie de sessão a cada request e barra acesso não autenticado.
 *
 * A ordem das operações aqui é sensível: o objeto de resposta precisa ser
 * recriado a partir do request depois que os cookies são atualizados, senão a
 * sessão renovada não chega ao browser e o usuário é deslogado silenciosamente.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() revalida o token no servidor Supabase — não trocar por getSession(),
  // que apenas lê o cookie e pode ser forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const ehPublica = ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota))

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // O webhook da Lowify é a única fonte que liga `acesso_liberado_em` — ter
  // sessão (`user` truthy) não basta mais, porque a conta pode ter sido criada
  // sem compra aprovada (ex.: login por senha de /dev, ou alguém batendo direto
  // no endpoint público de OTP do Supabase por fora da nossa UI). Sem essa
  // marca, a sessão é encerrada aqui mesmo — nunca chega a servir uma tela.
  let acessoLiberado = false
  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('acesso_liberado_em')
      .eq('id', user.id)
      .maybeSingle()
    acessoLiberado = !!usuario?.acesso_liberado_em
  }

  if (user && !acessoLiberado && !ehPublica) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('erro', 'sem_acesso')
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    if (acessoLiberado) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
    // Sessão sem acesso batendo na própria tela de login: encerra e deixa
    // renderizar o formulário, em vez de ficar preso num vaivém com o bloco
    // acima (que só age fora de rota pública, e /login é pública).
    await supabase.auth.signOut()
  }

  return supabaseResponse
}
