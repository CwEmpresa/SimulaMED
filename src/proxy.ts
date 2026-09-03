import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

/**
 * A partir do Next 16 esta convenção se chama "proxy" (antes "middleware").
 *
 * Aqui ele só renova a sessão e faz o redirecionamento otimista de rotas. A
 * autorização de verdade é o RLS no Postgres — nenhuma tela confia apenas nisto.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todas as rotas, exceto assets estáticos e imagens — que não precisam
     * do custo de revalidar sessão a cada request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
