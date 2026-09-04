import { createClient } from '@supabase/supabase-js'

import type { Database } from './types'

/**
 * Cliente com `service_role` — ignora RLS e privilégio de coluna. Só para
 * rotas de servidor que precisam agir como o sistema (ex.: o webhook da
 * Lowify em `src/app/api/webhooks/lowify/route.ts`), nunca em Server
 * Components normais nem em nada que possa rodar no browser: a service role
 * key equivale a acesso total ao banco, sem o RLS que protege o resto do app.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada neste ambiente.')
  }
  return createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
