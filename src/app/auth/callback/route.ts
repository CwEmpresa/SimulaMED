import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Destino do template padrão de e-mail do Supabase, que entrega um `code` (PKCE).
 * Existe em paralelo a /auth/confirm (token_hash) para que o login funcione tanto
 * com o template padrão quanto com um template customizado.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link_expirado`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
